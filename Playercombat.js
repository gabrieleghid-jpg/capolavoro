/**
 * PlayerCombat.js
 * Attack initiation, hitbox lifecycle, knockback, and legacy attack.
 * Mixed in to Player at construction time — never instantiate directly.
 */

import * as THREE from 'three';
import { Config } from './Config.js';

export const PlayerCombat = {

    // ── Public API ────────────────────────────────────────────────────

    /** Light attack (Mouse Left). Ignored if already attacking. */
    startLightAttack() {
        if (this.isStunned || this.isAttackingLight || this.isAttackingHeavy) return;
        this.isAttackingLight = true;
        this._lightTimer      = this._lightDur;
        this._activateHitboxDelayed(
            this.punchHitboxLight,
            this._lightDur * 0.40,
            this._lightDur * 0.25
        );
    },

    /** Heavy attack (Mouse Right). Ignored if already attacking. */
    startHeavyAttack() {
        if (this.isStunned || this.isAttackingLight || this.isAttackingHeavy) return;
        this.isAttackingHeavy = true;
        this._heavyTimer      = this._heavyDur;
        this._activateHitboxDelayed(
            this.punchHitboxHeavy,
            this._heavyDur * 0.30,
            this._heavyDur * 0.30
        );
    },

    /** Legacy single-hitbox attack (kept for GameScene.checkPlayerAttack). */
    attack() {
        if (this.isStunned || this.isAttacking) return;
        this.isAttacking  = true;
        this.attackTimer  = 0.25;
        this.hitboxMesh.visible = true;

        const attackOffset = new THREE.Vector3(0, 0, 1.5)
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
        this.hitboxMesh.position.copy(attackOffset);

        this.velocity.add(attackOffset.normalize().multiplyScalar(0.2));
    },

    /**
     * Apply knockback from an attacker's position.
     * @param {number}           force
     * @param {THREE.Vector3}    attackerPos
     */
    applyKnockback(force, attackerPos) {
        const direction = new THREE.Vector3()
            .subVectors(this.position, attackerPos)
            .normalize();

        const power = force * (1 + this.damage * Config.knockbackMultiplier * 2.5);

        this.velocity.x = direction.x * power;
        this.velocity.z = direction.z * power;
        this.velocity.y = Math.abs(direction.y) * power + power * 0.4;

        this.isStunned   = true;
        this.stunTimer   = Math.min(1.0, 0.2 + this.damage * 0.005);
        this.isAttacking = false;
        this.hitboxMesh.visible = false;
        this.isFastFalling = false;

        this._resetCombatState();
    },

    /**
     * Returns all currently active punch hitboxes as {mesh, type} objects.
     * Used by GameScene each frame for collision detection.
     */
    getActiveHitboxes() {
        const active = [];
        if (this.punchHitboxLight.active) active.push({ mesh: this.punchHitboxLight, type: 'light' });
        if (this.punchHitboxHeavy.active) active.push({ mesh: this.punchHitboxHeavy, type: 'heavy' });
        return active;
    },

    // ── Internal helpers ──────────────────────────────────────────────

    /**
     * Activate a hitbox after `delay` seconds, keep it active for `duration` seconds.
     * @param {THREE.Mesh} hitbox
     * @param {number}     delay     seconds before activation
     * @param {number}     duration  seconds the hitbox stays active
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
    },

    /** Force-deactivate both punch hitboxes (called on knockback / respawn). */
    _deactivateAllHitboxes() {
        this.punchHitboxLight.visible = false;
        this.punchHitboxLight.active  = false;
        this.punchHitboxHeavy.visible = false;
        this.punchHitboxHeavy.active  = false;
    },

    /** Advance legacy attack timer. Call inside update(). */
    _tickAttackTimer(deltaTime) {
        if (this.attackTimer > 0) {
            this.attackTimer -= deltaTime;
            if (this.attackTimer <= 0) {
                this.isAttacking        = false;
                this.hitboxMesh.visible = false;
            }
        }
    },

    /** Reset all attack state — used on knockback and respawn. */
    _resetCombatState() {
        this.isAttackingLight = false;
        this.isAttackingHeavy = false;
        this._lightTimer      = 0;
        this._heavyTimer      = 0;
        this._resetMeshTransform?.();
        this._deactivateAllHitboxes();
    },
};