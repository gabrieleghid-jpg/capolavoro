/**
 * PlayerPhysics.js
 * Gravity, drag, dash physics, platform collision, respawn, and WASD input.
 * Mixed in to Player at construction time — never instantiate directly.
 */

import * as THREE from 'three';
import { Config } from './Config.js';

export const PlayerPhysics = {

    /** Read WASD / Arrow keys and apply velocity impulses. */
    handleInput(keys) {
        if (this.isStunned || this.isDashing) return;

        const left  = keys['KeyA'] || keys['ArrowLeft'];
        const right = keys['KeyD'] || keys['ArrowRight'];
        const up    = keys['KeyW'] || keys['ArrowUp'];
        const down  = keys['KeyS'] || keys['ArrowDown'];

        let moveX = 0;
        let moveZ = 0;

        if (left)  moveX -= Config.moveSpeed;
        if (right) moveX += Config.moveSpeed;
        if (up)    moveZ -= Config.moveSpeed;

        if (down && !this.isGrounded) {
            if (!this.isFastFalling && this.velocity.y < 0) {
                this.velocity.y  = Config.maxFallSpeed * Config.fastFallMultiplier;
                this.isFastFalling = true;
            }
        } else if (down) {
            moveZ += Config.moveSpeed;
        }

        const airControl = this.isGrounded ? 1.0 : Config.airControl;

        if (moveX !== 0) {
            this.velocity.x = THREE.MathUtils.clamp(
                this.velocity.x + moveX * airControl,
                -Config.maxMoveSpeed, Config.maxMoveSpeed
            );
        }
        if (moveZ !== 0) {
            this.velocity.z = THREE.MathUtils.clamp(
                this.velocity.z + moveZ * airControl,
                -Config.maxMoveSpeed, Config.maxMoveSpeed
            );
        }

        if (Math.abs(moveX) > 0.001 || Math.abs(moveZ) > 0.001) {
            this.mesh.rotation.y = Math.atan2(moveX, moveZ);
        }
    },

    /** Trigger a jump if jumps remain. */
    jump() {
        if (this.isStunned || this.isDashing) return;
        if (this.jumpsLeft > 0) {
            this.velocity.y    = Config.jumpForce;
            this.jumpsLeft--;
            this.isGrounded    = false;
            this.isFastFalling = false;
        }
    },

    /** Start a dash in the current movement direction. */
    dash() {
        if (this.isStunned || this.dashCooldown > 0) return;
        this.isDashing    = true;
        this.dashTimer    = 0.45;
        this.dashCooldown = 1.0;

        const dashDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
        if (dashDir.lengthSq() < 0.1) {
            dashDir.set(
                Math.sin(this.mesh.rotation.y),
                0,
                Math.cos(this.mesh.rotation.y)
            );
        }
        this.dashDirection = dashDir.clone();
        this.velocity.x = 0;
        this.velocity.z = 0;
    },

    /**
     * Advance all physics for one frame.
     * @param {number}            deltaTime
     * @param {THREE.Mesh[]}      platforms
     */
    _tickPhysics(deltaTime, platforms) {
        // ── Gravity ────────────────────────────────────────────────────
        if (!this.isGrounded && !this.isDashing) {
            this.velocity.y += Config.gravity;
            if (this.velocity.y < Config.maxFallSpeed) {
                this.velocity.y = Config.maxFallSpeed;
            }
        }

        // ── Drag ───────────────────────────────────────────────────────
        const drag = this.isGrounded ? Config.drag : Config.airDrag;
        this.velocity.x *= drag;
        this.velocity.z *= drag;
        if (!this.isDashing) this.velocity.y *= 0.98;

        // ── Dash propulsion ────────────────────────────────────────────
        if (this.isDashing) {
            this.dashTimer -= deltaTime;
            const easedProgress = Math.max(0, this.dashTimer / 0.45) ** 2;
            this.velocity.x = this.dashDirection.x * Config.dashForce * 8 * easedProgress;
            this.velocity.z = this.dashDirection.z * Config.dashForce * 8 * easedProgress;
            if (this.dashTimer <= 0) this.isDashing = false;
        }

        // ── Horizontal movement ────────────────────────────────────────
        this.position.x += this.velocity.x;
        this.position.z += this.velocity.z;

        // ── Vertical movement (sub-stepped) ───────────────────────────
        this.isGrounded   = false;
        const steps       = Math.ceil(Math.abs(this.velocity.y) / 0.5);
        const stepVelY    = this.velocity.y / steps;

        for (let s = 0; s < steps; s++) {
            this.position.y += stepVelY;

            for (const platform of platforms) {
                const hw = platform.geometry.parameters.width  / 2;
                const hh = platform.geometry.parameters.height / 2;
                const hd = platform.geometry.parameters.depth  / 2;

                const px = platform.position.x;
                const py = platform.position.y;
                const pz = platform.position.z;

                const inXZ =
                    this.position.x + 0.6 > px - hw &&
                    this.position.x - 0.6 < px + hw &&
                    this.position.z + 0.6 > pz - hd &&
                    this.position.z - 0.6 < pz + hd;

                if (!inXZ) continue;

                const platTop = py + hh;
                const platBot = py - hh;
                const feetY   = this.position.y - 1;
                const headY   = this.position.y + 1;

                if (stepVelY <= 0 && feetY <= platTop && feetY >= platBot) {
                    this.position.y = platTop + 1;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    this.jumpsLeft  = 2;
                    this.isFastFalling = false;
                } else if (stepVelY > 0 && headY >= platBot && headY <= platTop) {
                    this.position.y = platBot - 1;
                    this.velocity.y = 0;
                }
            }

            if (this.isGrounded) break;
        }

        // ── Cooldown timers ────────────────────────────────────────────
        if (this.dashCooldown > 0) this.dashCooldown -= deltaTime;
        if (this.stunTimer     > 0) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) this.isStunned = false;
        }

        // ── Out-of-bounds / death check ────────────────────────────────
        const b = Config.arenaBounds;
        if (
            Math.abs(this.position.x) > b.x ||
            this.position.y < -15 ||
            Math.abs(this.position.z) > b.z
        ) {
            this.respawn();
        }
    },

    /** Respawn the player at a safe position. */
    respawn() {
        this.position.set(
            Math.random() * 10 - 5,
            15,
            Math.random() * 10 - 5
        );
        this.velocity.set(0, 0, 0);
        this.damage        = 0;
        this.isStunned     = false;
        this.jumpsLeft     = 2;
        this.isFastFalling = false;

        // Reset combat state too (via PlayerCombat mixin)
        this._resetCombatState?.();
    },
};