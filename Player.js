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

        this.hitboxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, visible: false })
        );
        this.add(this.hitboxMesh);

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
    }

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
            // Curva ease-out quadratica: parte veloce e decelera gradualmente
            const progress = Math.max(0, this.dashTimer / 0.45);
            const easedProgress = progress * progress;
            this.velocity.x = this.dashDirection.x * Config.dashForce * 8 * easedProgress;
            this.velocity.z = this.dashDirection.z * Config.dashForce * 8 * easedProgress;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                // Inerzia naturale: non si azzera la velocità di scatto
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
    }
}