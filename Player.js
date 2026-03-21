import * as THREE from 'three';
import { Config } from './Config.js';

export class Player extends THREE.Group {
    constructor(id, color, initialX) {
        super();
        this.playerId = id;
        this.color = color;

        const geometry = new THREE.BoxGeometry(1.2, 2, 1.2);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            emissive: color,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.add(this.mesh);

        // ── Legacy hitbox (kept for applyKnockback compatibility) ─────
        this.hitboxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this.add(this.hitboxMesh);

        // ── Light punch hitbox — small, fast, close range ─────────────
        this.punchHitboxLight = new THREE.Mesh(
            new THREE.BoxGeometry(1.2, 1.0, 1.2),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff, wireframe: true,
                transparent: true, opacity: 0.6, visible: false
            })
        );
        // Offset: in front of player, at chest height
        this.punchHitboxLight.position.set(0, 0.2, 1.5);
        this.punchHitboxLight.active = false;
        this.add(this.punchHitboxLight);

        // ── Heavy punch hitbox — larger, slower, longer reach ─────────
        this.punchHitboxHeavy = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 1.4, 2.0),
            new THREE.MeshBasicMaterial({
                color: 0xff6600, wireframe: true,
                transparent: true, opacity: 0.6, visible: false
            })
        );
        this.punchHitboxHeavy.position.set(0, 0.1, 2.0);
        this.punchHitboxHeavy.active = false;
        this.add(this.punchHitboxHeavy);

        this.position.set(initialX, 5, 0);
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.jumpsLeft = 2;
        this.dashCooldown = 0;
        this.dashDirection = new THREE.Vector3();
        
        this.damage = 0;
        this.isStunned = false;
        this.stunTimer = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.attackTimer = 0;
        this.isAttacking = false;
        this.isFastFalling = false;

        // ── Attack state ──────────────────────────────────────────────
        this.isAttackingLight = false;   // Mouse left click
        this.isAttackingHeavy = false;   // Mouse right click

        // Internal animation timers (seconds)
        this._lightTimer  = 0;
        this._lightDur    = 0.25;
        this._heavyTimer  = 0;
        this._heavyDur    = 0.55;

        // Hit reaction
        this._shakeTimer    = 0;
        this._shakeDuration = 0;
        this._shakeAmount   = 0;

        // Store original mesh transform so we can restore it
        this._baseScale    = this.mesh.scale.clone();
        this._baseRotation = this.mesh.rotation.clone();
    }

    // ─────────────────────────────────────────────────────────────────
    //  Public API — called by PlayerController / GameScene
    // ─────────────────────────────────────────────────────────────────

    /** Light attack (Mouse Left). Ignored if already attacking. */
    startLightAttack() {
        if (this.isStunned || this.isAttackingLight || this.isAttackingHeavy) return;
        this.isAttackingLight = true;
        this._lightTimer = this._lightDur;

        // Activate light hitbox at peak of punch (after wind-up: 40% of duration)
        this._activateHitboxDelayed(this.punchHitboxLight, this._lightDur * 0.40, this._lightDur * 0.25);
    }

    /** Heavy attack (Mouse Right). Ignored if already attacking. */
    startHeavyAttack() {
        if (this.isStunned || this.isAttackingLight || this.isAttackingHeavy) return;
        this.isAttackingHeavy = true;
        this._heavyTimer = this._heavyDur;

        // Activate heavy hitbox at slam peak (after charge: 30% of duration)
        this._activateHitboxDelayed(this.punchHitboxHeavy, this._heavyDur * 0.30, this._heavyDur * 0.30);
    }

    /**
     * Activates a hitbox after `delay` seconds, keeps it active for `duration` seconds.
     * @param {THREE.Mesh} hitbox
     * @param {number} delay    seconds before activation
     * @param {number} duration seconds the hitbox stays active
     */
    _activateHitboxDelayed(hitbox, delay, duration) {
        setTimeout(() => {
            hitbox.visible = true;
            hitbox.active  = true;
            setTimeout(() => {
                hitbox.visible = false;
                hitbox.active  = false;
            }, duration * 1000);
        }, delay * 1000);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Procedural animations
    // ─────────────────────────────────────────────────────────────────

    /**
     * Light attack — quick forward lunge + squash/stretch.
     *  0%→40%  : punch forward (scale Z squash, scale X/Y stretch)
     *  40%→100%: return to normal
     */
    _animateLightAttack(deltaTime) {
        this._lightTimer -= deltaTime;
        const t = 1 - Math.max(0, this._lightTimer) / this._lightDur; // 0→1

        if (t < 0.4) {
            // Wind-up / punch-out
            const p = t / 0.4;                    // 0→1 within this phase
            this.mesh.scale.z = 1 + p * 0.6;      // stretch forward
            this.mesh.scale.x = 1 - p * 0.25;     // squash sides
            this.mesh.scale.y = 1 - p * 0.15;
            this.mesh.rotation.x = -p * 0.35;     // tip forward
        } else {
            // Snap back with slight overshoot (easeOutElastic feel)
            const p = (t - 0.4) / 0.6;            // 0→1 within this phase
            const bounce = Math.sin(p * Math.PI);  // smooth return
            this.mesh.scale.z = 1 + (1 - p) * 0.15 * bounce;
            this.mesh.scale.x = 1;
            this.mesh.scale.y = 1;
            this.mesh.rotation.x = -(1 - p) * 0.1 * bounce;
        }

        if (this._lightTimer <= 0) {
            this._resetMeshTransform();
            this.isAttackingLight = false;
        }
    }

    /**
     * Heavy attack — slow charge + big slam + screen-shake-like wobble.
     *  0%→30%  : charge (shrink back / lean back)
     *  30%→60% : slam forward (big stretch)
     *  60%→100%: decay wobble back to idle
     */
    _animateHeavyAttack(deltaTime) {
        this._heavyTimer -= deltaTime;
        const t = 1 - Math.max(0, this._heavyTimer) / this._heavyDur; // 0→1

        if (t < 0.3) {
            // Charge — lean back
            const p = t / 0.3;
            this.mesh.scale.z = 1 - p * 0.35;
            this.mesh.scale.x = 1 + p * 0.25;
            this.mesh.scale.y = 1 + p * 0.20;
            this.mesh.rotation.x = p * 0.45;       // tip backward
        } else if (t < 0.6) {
            // Slam — explosive forward
            const p = (t - 0.3) / 0.3;
            this.mesh.scale.z = 0.65 + p * 1.1;    // 0.65 → 1.75
            this.mesh.scale.x = 1.25 - p * 0.5;
            this.mesh.scale.y = 1.20 - p * 0.4;
            this.mesh.rotation.x = 0.45 - p * 0.9; // tip backward → forward
        } else {
            // Decay wobble
            const p = (t - 0.6) / 0.4;
            const wobble = Math.sin(p * Math.PI * 3) * (1 - p); // damped oscillation
            this.mesh.scale.z = 1 + wobble * 0.18;
            this.mesh.scale.x = 1 - wobble * 0.08;
            this.mesh.scale.y = 1 - wobble * 0.06;
            this.mesh.rotation.x = wobble * 0.12;
        }

        if (this._heavyTimer <= 0) {
            this._resetMeshTransform();
            this.isAttackingHeavy = false;
        }
    }

    /** Idle animation — gentle floating bob */
    _animateIdle(deltaTime) {
        const t = performance.now() * 0.001;
        this.mesh.position.y = Math.sin(t * 1.8) * 0.04;
    }

    /** Running animation — side-to-side tilt */
    _animateRunning(deltaTime) {
        const t = performance.now() * 0.001;
        this.mesh.rotation.z = Math.sin(t * 10) * 0.08;
    }

    _resetMeshTransform() {
        this.mesh.scale.set(1, 1, 1);
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
        this.mesh.position.y = 0;
    }

    /** Force-deactivate both punch hitboxes (used on knockback / respawn). */
    _deactivateAllHitboxes() {
        this.punchHitboxLight.visible = false;
        this.punchHitboxLight.active  = false;
        this.punchHitboxHeavy.visible = false;
        this.punchHitboxHeavy.active  = false;
    }

    /**
     * Called by HitFeedback.onHit() when this player/dummy is struck.
     * Triggers a shake + emissive flash on the mesh.
     * @param {'light'|'heavy'} type
     */
    receiveHit(type) {
        const isHeavy = type === 'heavy';

        // Flash: switch emissive to white briefly
        this.mesh.material.emissive.set(0xffffff);
        this.mesh.material.emissiveIntensity = isHeavy ? 1.8 : 1.0;

        // Shake: store origin and start shaking
        this._shakeTimer    = isHeavy ? 0.25 : 0.14;
        this._shakeDuration = this._shakeTimer;
        this._shakeAmount   = isHeavy ? 0.30 : 0.16;

        // Restore emissive after flash duration
        const flashDur = isHeavy ? 120 : 70; // ms
        setTimeout(() => {
            this.mesh.material.emissive.setHex(this.color);
            this.mesh.material.emissiveIntensity = 0.3;
        }, flashDur);
    }

    /** Advance hit-shake animation. Called inside update(). */
    _updateShake(deltaTime) {
        if (this._shakeTimer <= 0) return;
        this._shakeTimer -= deltaTime;

        const t      = this._shakeTimer / this._shakeDuration; // 1→0
        const amount = this._shakeAmount * t;                  // fades out

        // Rapid oscillation on X and Z
        const freq = 40;
        const time = performance.now() * 0.001;
        this.mesh.position.x = Math.sin(time * freq)       * amount;
        this.mesh.position.z = Math.cos(time * freq * 0.7) * amount;

        if (this._shakeTimer <= 0) {
            this.mesh.position.x = 0;
            this.mesh.position.z = 0;
        }
    }

    /**
     * Returns all currently active punch hitboxes as {mesh, type} objects.
     * Used by GameScene to run collision detection each frame.
     */
    getActiveHitboxes() {
        const active = [];
        if (this.punchHitboxLight.active) active.push({ mesh: this.punchHitboxLight, type: 'light' });
        if (this.punchHitboxHeavy.active) active.push({ mesh: this.punchHitboxHeavy, type: 'heavy' });
        return active;
    }

    // ─────────────────────────────────────────────────────────────────
    //  Existing game logic (unchanged)
    // ─────────────────────────────────────────────────────────────────

    handleInput(keys) {
        if (this.isStunned || this.isDashing) return;

        const left = keys['KeyA'] || keys['ArrowLeft'];
        const right = keys['KeyD'] || keys['ArrowRight'];
        const up = keys['KeyW'] || keys['ArrowUp'];
        const down = keys['KeyS'] || keys['ArrowDown'];
        
        let moveX = 0;
        let moveZ = 0;

        if (left) moveX -= Config.moveSpeed;
        if (right) moveX += Config.moveSpeed;
        if (up) moveZ -= Config.moveSpeed;

        if (down && !this.isGrounded) {
            if (!this.isFastFalling && this.velocity.y < 0) {
                this.velocity.y = Config.maxFallSpeed * Config.fastFallMultiplier;
                this.isFastFalling = true;
            }
        } else if (down) {
            moveZ += Config.moveSpeed;
        }

        const airControl = this.isGrounded ? 1.0 : Config.airControl;

        if (moveX !== 0) {
            this.velocity.x = THREE.MathUtils.clamp(
                this.velocity.x + moveX * airControl,
                -Config.maxMoveSpeed,
                Config.maxMoveSpeed
            );
        }
        if (moveZ !== 0) {
            this.velocity.z = THREE.MathUtils.clamp(
                this.velocity.z + moveZ * airControl,
                -Config.maxMoveSpeed,
                Config.maxMoveSpeed
            );
        }

        if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
            const angle = Math.atan2(moveX, moveZ);
            this.mesh.rotation.y = angle;
        }
    }

    jump() {
        if (this.isStunned || this.isDashing) return;
        if (this.jumpsLeft > 0) {
            this.velocity.y = Config.jumpForce;
            this.jumpsLeft--;
            this.isGrounded = false;
            this.isFastFalling = false;
        }
    }

    dash() {
        if (this.isStunned || this.dashCooldown > 0) return;
        this.isDashing = true;
        this.dashTimer = 0.45;
        this.dashCooldown = 1.0;

        const dashDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
        if (dashDir.lengthSq() < 0.1) dashDir.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));

        this.dashDirection = dashDir.clone();
        this.velocity.x = 0;
        this.velocity.z = 0;
    }

    attack() {
        if (this.isStunned || this.isAttacking) return;
        this.isAttacking = true;
        this.attackTimer = 0.25;
        this.hitboxMesh.visible = true;
        
        const attackOffset = new THREE.Vector3(0, 0, 1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        this.hitboxMesh.position.copy(attackOffset);
        
        this.velocity.add(attackOffset.normalize().multiplyScalar(0.2));
    }

    applyKnockback(force, attackerPos) {
        const direction = new THREE.Vector3().subVectors(this.position, attackerPos).normalize();
        const power = force * (1 + (this.damage * Config.knockbackMultiplier) * 2.5);
        
        this.velocity.x = direction.x * power;
        this.velocity.z = direction.z * power;
        this.velocity.y = Math.abs(direction.y) * power + power * 0.4;
        
        this.isStunned = true;
        this.stunTimer = Math.min(1.0, 0.2 + this.damage * 0.005);
        this.isAttacking = false;
        this.hitboxMesh.visible = false;
        this.isFastFalling = false;

        // Interrupt any attack animations
        this.isAttackingLight = false;
        this.isAttackingHeavy = false;
        this._lightTimer = 0;
        this._heavyTimer = 0;
        this._resetMeshTransform();
        this._deactivateAllHitboxes();
    }

    update(deltaTime, platforms) {
        if (!this.isGrounded && !this.isDashing) {
            this.velocity.y += Config.gravity;
            if (this.velocity.y < Config.maxFallSpeed) {
                this.velocity.y = Config.maxFallSpeed;
            }
        }

        const drag = this.isGrounded ? Config.drag : Config.airDrag;
        this.velocity.x *= drag;
        this.velocity.z *= drag;
        if (!this.isDashing) this.velocity.y *= 0.98;

        if (this.isDashing) {
            this.dashTimer -= deltaTime;
            const progress = Math.max(0, this.dashTimer / 0.45);
            const easedProgress = progress * progress;
            this.velocity.x = this.dashDirection.x * Config.dashForce * 8 * easedProgress;
            this.velocity.z = this.dashDirection.z * Config.dashForce * 8 * easedProgress;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        const steps = Math.ceil(Math.abs(this.velocity.y) / 0.5);
        const stepVelY = this.velocity.y / steps;

        this.position.x += this.velocity.x;
        this.position.z += this.velocity.z;

        this.isGrounded = false;

        for (let s = 0; s < steps; s++) {
            this.position.y += stepVelY;

            for (const platform of platforms) {
                const platTop = platform.position.y + platform.geometry.parameters.height / 2;
                const platBot = platform.position.y - platform.geometry.parameters.height / 2;

                const inXZ = this.position.x + 0.6 > platform.position.x - platform.geometry.parameters.width / 2 &&
                             this.position.x - 0.6 < platform.position.x + platform.geometry.parameters.width / 2 &&
                             this.position.z + 0.6 > platform.position.z - platform.geometry.parameters.depth / 2 &&
                             this.position.z - 0.6 < platform.position.z + platform.geometry.parameters.depth / 2;

                if (!inXZ) continue;

                const feetY = this.position.y - 1;
                const headY = this.position.y + 1;

                if (stepVelY <= 0 && feetY <= platTop && feetY >= platBot) {
                    this.position.y = platTop + 1;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    this.jumpsLeft = 2;
                    this.isFastFalling = false;
                }
                else if (stepVelY > 0 && headY >= platBot && headY <= platTop) {
                    this.position.y = platBot - 1;
                    this.velocity.y = 0;
                }
            }

            if (this.isGrounded) break;
        }

        if (this.dashCooldown > 0) this.dashCooldown -= deltaTime;
        if (this.stunTimer > 0) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) this.isStunned = false;
        }
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.hitboxMesh.visible = false;
            }
        }

        // ── Animation state machine ───────────────────────────────────
        if (this.isAttackingLight) {
            this._animateLightAttack(deltaTime);
        } else if (this.isAttackingHeavy) {
            this._animateHeavyAttack(deltaTime);
        } else {
            const isMoving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
            if (isMoving) {
                this._animateRunning(deltaTime);
            } else {
                this._animateIdle(deltaTime);
            }
        }

        // Hit shake (runs independently of attack state)
        this._updateShake(deltaTime);
        // ─────────────────────────────────────────────────────────────

        if (Math.abs(this.position.x) > Config.arenaBounds.x || 
            this.position.y < -15 || 
            Math.abs(this.position.z) > Config.arenaBounds.z) {
            this.respawn();
        }
    }

    respawn() {
        this.position.set(Math.random() * 10 - 5, 15, Math.random() * 10 - 5);
        this.velocity.set(0, 0, 0);
        this.damage = 0;
        this.isStunned = false;
        this.jumpsLeft = 2;
        this.isFastFalling = false;
        this.isAttackingLight = false;
        this.isAttackingHeavy = false;
        this._lightTimer = 0;
        this._heavyTimer = 0;
        this._resetMeshTransform();
        this._deactivateAllHitboxes();
    }
}