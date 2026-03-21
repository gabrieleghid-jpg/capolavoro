/**
 * PlayerAnimations.js
 * Procedural mesh animations: idle, run, light attack, heavy attack, hit-shake.
 * Mixed in to Player at construction time — never instantiate directly.
 */

export const PlayerAnimations = {

    /** Light attack — quick forward lunge + squash/stretch.
     *  0%→40%  : punch forward (scale Z squash, scale X/Y stretch)
     *  40%→100%: return to normal
     */
    _animateLightAttack(deltaTime) {
        this._lightTimer -= deltaTime;
        const t = 1 - Math.max(0, this._lightTimer) / this._lightDur; // 0→1

        if (t < 0.4) {
            const p = t / 0.4;
            this.mesh.scale.z    = 1 + p * 0.6;
            this.mesh.scale.x    = 1 - p * 0.25;
            this.mesh.scale.y    = 1 - p * 0.15;
            this.mesh.rotation.x = -p * 0.35;
        } else {
            const p      = (t - 0.4) / 0.6;
            const bounce = Math.sin(p * Math.PI);
            this.mesh.scale.z    = 1 + (1 - p) * 0.15 * bounce;
            this.mesh.scale.x    = 1;
            this.mesh.scale.y    = 1;
            this.mesh.rotation.x = -(1 - p) * 0.1 * bounce;
        }

        if (this._lightTimer <= 0) {
            this._resetMeshTransform();
            this.isAttackingLight = false;
        }
    },

    /** Heavy attack — slow charge + big slam + decay wobble.
     *  0%→30%  : charge (lean back)
     *  30%→60% : slam forward (big stretch)
     *  60%→100%: decay wobble
     */
    _animateHeavyAttack(deltaTime) {
        this._heavyTimer -= deltaTime;
        const t = 1 - Math.max(0, this._heavyTimer) / this._heavyDur;

        if (t < 0.3) {
            const p = t / 0.3;
            this.mesh.scale.z    = 1 - p * 0.35;
            this.mesh.scale.x    = 1 + p * 0.25;
            this.mesh.scale.y    = 1 + p * 0.20;
            this.mesh.rotation.x = p * 0.45;
        } else if (t < 0.6) {
            const p = (t - 0.3) / 0.3;
            this.mesh.scale.z    = 0.65 + p * 1.1;
            this.mesh.scale.x    = 1.25 - p * 0.5;
            this.mesh.scale.y    = 1.20 - p * 0.4;
            this.mesh.rotation.x = 0.45 - p * 0.9;
        } else {
            const p      = (t - 0.6) / 0.4;
            const wobble = Math.sin(p * Math.PI * 3) * (1 - p);
            this.mesh.scale.z    = 1 + wobble * 0.18;
            this.mesh.scale.x    = 1 - wobble * 0.08;
            this.mesh.scale.y    = 1 - wobble * 0.06;
            this.mesh.rotation.x = wobble * 0.12;
        }

        if (this._heavyTimer <= 0) {
            this._resetMeshTransform();
            this.isAttackingHeavy = false;
        }
    },

    /** Idle — gentle floating bob. */
    _animateIdle(_deltaTime) {
        const t = performance.now() * 0.001;
        this.mesh.position.y = Math.sin(t * 1.8) * 0.04;
    },

    /** Running — side-to-side tilt. */
    _animateRunning(_deltaTime) {
        const t = performance.now() * 0.001;
        this.mesh.rotation.z = Math.sin(t * 10) * 0.08;
    },

    /** Restore mesh to default transform. */
    _resetMeshTransform() {
        this.mesh.scale.set(1, 1, 1);
        this.mesh.rotation.x = 0;
        this.mesh.rotation.z = 0;
        this.mesh.position.y = 0;
    },

    /**
     * Called by receiveHit() — triggers emissive flash + positional shake.
     * @param {'light'|'heavy'} type
     */
    receiveHit(type) {
        const isHeavy = type === 'heavy';

        this.mesh.material.emissive.set(0xffffff);
        this.mesh.material.emissiveIntensity = isHeavy ? 1.8 : 1.0;

        this._shakeTimer    = isHeavy ? 0.25 : 0.14;
        this._shakeDuration = this._shakeTimer;
        this._shakeAmount   = isHeavy ? 0.30 : 0.16;

        setTimeout(() => {
            this.mesh.material.emissive.setHex(this.color);
            this.mesh.material.emissiveIntensity = 0.3;
        }, isHeavy ? 120 : 70);
    },

    /** Advance hit-shake. Call inside update(). */
    _updateShake(deltaTime) {
        if (this._shakeTimer <= 0) return;
        this._shakeTimer -= deltaTime;

        const t      = this._shakeTimer / this._shakeDuration;
        const amount = this._shakeAmount * t;
        const freq   = 40;
        const time   = performance.now() * 0.001;

        this.mesh.position.x = Math.sin(time * freq)        * amount;
        this.mesh.position.z = Math.cos(time * freq * 0.7)  * amount;

        if (this._shakeTimer <= 0) {
            this.mesh.position.x = 0;
            this.mesh.position.z = 0;
        }
    },

    /**
     * Top-level animation state machine — call once per frame after physics.
     */
    _tickAnimations(deltaTime) {
        if (this.isAttackingLight) {
            this._animateLightAttack(deltaTime);
        } else if (this.isAttackingHeavy) {
            this._animateHeavyAttack(deltaTime);
        } else {
            const isMoving = Math.abs(this.velocity.x) > 0.5 || Math.abs(this.velocity.z) > 0.5;
            isMoving ? this._animateRunning(deltaTime) : this._animateIdle(deltaTime);
        }
        this._updateShake(deltaTime);
    },
};