/**
 * Player.js
 * Thin orchestrator class.
 * All logic lives in the three mixin modules:
 *   PlayerPhysics   → gravity, drag, dash, platform collision, respawn, WASD input
 *   PlayerCombat    → attacks, hitboxes, knockback
 *   PlayerAnimations→ procedural mesh animations + hit-shake
 */

import * as THREE    from 'three';
import { Config }    from './Config.js';
import { PlayerPhysics }    from './Playerphysics.js';
import { PlayerCombat }     from './Playercombat.js';
import { PlayerAnimations } from './Playeranimations.js';

export class Player extends THREE.Group {

    constructor(id, color, initialX) {
        super();
        this.playerId = id;
        this.color    = color;

        // ── Visible mesh ──────────────────────────────────────────────
        const geometry = new THREE.BoxGeometry(1.2, 2, 1.2);
        const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.3,
            roughness: 0.3,
            metalness: 0.8,
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
                transparent: true, opacity: 0.6, visible: false,
            })
        );
        this.punchHitboxLight.position.set(0, 0.2, 1.5);
        this.punchHitboxLight.active = false;
        this.add(this.punchHitboxLight);

        // ── Heavy punch hitbox — larger, slower, longer reach ─────────
        this.punchHitboxHeavy = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 1.4, 2.0),
            new THREE.MeshBasicMaterial({
                color: 0xff6600, wireframe: true,
                transparent: true, opacity: 0.6, visible: false,
            })
        );
        this.punchHitboxHeavy.position.set(0, 0.1, 2.0);
        this.punchHitboxHeavy.active = false;
        this.add(this.punchHitboxHeavy);

        // ── Initial transform ─────────────────────────────────────────
        this.position.set(initialX, 5, 0);

        // ── Physics state ─────────────────────────────────────────────
        this.velocity      = new THREE.Vector3();
        this.isGrounded    = false;
        this.jumpsLeft     = 2;
        this.dashCooldown  = 0;
        this.dashDirection = new THREE.Vector3();
        this.isDashing     = false;
        this.dashTimer     = 0;
        this.isFastFalling = false;

        // ── Combat state ──────────────────────────────────────────────
        this.damage          = 0;
        this.isStunned       = false;
        this.stunTimer       = 0;
        this.isAttacking     = false;   // legacy flag
        this.attackTimer     = 0;
        this.isAttackingLight = false;
        this.isAttackingHeavy = false;

        // Attack durations (seconds)
        this._lightTimer = 0;
        this._lightDur   = 0.25;
        this._heavyTimer = 0;
        this._heavyDur   = 0.55;

        // ── Animation / hit-shake state ───────────────────────────────
        this._shakeTimer    = 0;
        this._shakeDuration = 0;
        this._shakeAmount   = 0;
    }

    // ── Main update — called once per frame by GameScene ─────────────

    /**
     * @param {number}        deltaTime
     * @param {THREE.Mesh[]}  platforms
     */
    update(deltaTime, platforms) {
        this._tickPhysics(deltaTime, platforms);
        this._tickAttackTimer(deltaTime);
        this._tickAnimations(deltaTime);
    }
}

// ── Mix in all modules ────────────────────────────────────────────────
Object.assign(Player.prototype, PlayerPhysics);
Object.assign(Player.prototype, PlayerCombat);
Object.assign(Player.prototype, PlayerAnimations);