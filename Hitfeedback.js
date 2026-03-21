import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
//  HitSound — procedural Web Audio API, no external files needed
// ─────────────────────────────────────────────────────────────────────────────

class HitSound {
    constructor() {
        this._ctx = null;
    }

    _getCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        // Resume if suspended (browsers require user gesture first)
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    }

    /**
     * Play a procedural punch sound.
     * @param {'light'|'heavy'} type
     */
    play(type) {
        try {
            const ctx  = this._getCtx();
            const now  = ctx.currentTime;

            if (type === 'light') {
                // Short, snappy thud — low-pass filtered noise burst
                this._noiseBurst(ctx, now, {
                    duration:   0.08,
                    gainPeak:   0.6,
                    filterFreq: 800,
                    pitchStart: 220,
                    pitchEnd:   80
                });
            } else {
                // Heavy: deeper thud + low rumble tail
                this._noiseBurst(ctx, now, {
                    duration:   0.18,
                    gainPeak:   1.0,
                    filterFreq: 400,
                    pitchStart: 140,
                    pitchEnd:   40
                });
                // Sub boom
                this._tone(ctx, now + 0.02, {
                    frequency: 60,
                    duration:  0.12,
                    gain:      0.35
                });
            }
        } catch (e) {
            // Silently ignore audio errors (e.g. autoplay policy)
        }
    }

    _noiseBurst(ctx, now, { duration, gainPeak, filterFreq, pitchStart, pitchEnd }) {
        // Noise oscillator via sawtooth (approximates punch transient)
        const osc    = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain   = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitchStart, now);
        osc.frequency.exponentialRampToValueAtTime(pitchEnd, now + duration);

        filter.type            = 'lowpass';
        filter.frequency.value = filterFreq;
        filter.Q.value         = 1.5;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(gainPeak, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }

    _tone(ctx, now, { frequency, duration, gain: gainVal }) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type      = 'sine';
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HitParticles — sparks / dust burst at impact point
// ─────────────────────────────────────────────────────────────────────────────

class HitParticles {
    constructor(scene) {
        this.scene    = scene;
        this._active  = []; // [{points, velocities, life, maxLife}]
    }

    /**
     * Spawn a particle burst at a world-space position.
     * @param {THREE.Vector3} position
     * @param {'light'|'heavy'} type
     */
    spawn(position, type) {
        const count      = type === 'heavy' ? 22 : 12;
        const speed      = type === 'heavy' ? 7  : 4;
        const color      = type === 'heavy' ? 0xff6600 : 0x00ddff;
        const size       = type === 'heavy' ? 0.18 : 0.12;
        const maxLife    = type === 'heavy' ? 0.55 : 0.35;

        const positions  = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            // All particles start at the impact point
            positions[i * 3]     = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;

            // Random outward velocity — mostly forward/sideways, some upward
            const theta = Math.random() * Math.PI * 2;
            const phi   = (Math.random() - 0.3) * Math.PI * 0.8; // bias upward
            velocities.push(new THREE.Vector3(
                Math.cos(theta) * Math.cos(phi) * speed * (0.5 + Math.random()),
                Math.sin(phi)   * speed * (0.5 + Math.random()) + 2,
                Math.sin(theta) * Math.cos(phi) * speed * (0.5 + Math.random())
            ));
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color,
            size,
            transparent: true,
            opacity:     1.0,
            depthWrite:  false,
            sizeAttenuation: true
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this._active.push({ points, velocities, life: maxLife, maxLife, posArr: positions });
    }

    /**
     * Advance all active particle systems. Call every frame.
     * @param {number} deltaTime
     */
    update(deltaTime) {
        const gravity = -12;

        for (let i = this._active.length - 1; i >= 0; i--) {
            const p = this._active[i];
            p.life -= deltaTime;

            if (p.life <= 0) {
                this.scene.remove(p.points);
                p.points.geometry.dispose();
                p.points.material.dispose();
                this._active.splice(i, 1);
                continue;
            }

            const t = p.life / p.maxLife; // 1→0 as particles die
            p.points.material.opacity = t * t; // quadratic fade

            const count = p.velocities.length;
            for (let j = 0; j < count; j++) {
                p.velocities[j].y += gravity * deltaTime;

                p.posArr[j * 3]     += p.velocities[j].x * deltaTime;
                p.posArr[j * 3 + 1] += p.velocities[j].y * deltaTime;
                p.posArr[j * 3 + 2] += p.velocities[j].z * deltaTime;
            }

            p.points.geometry.attributes.position.needsUpdate = true;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HitFeedback — facade that wires everything together
// ─────────────────────────────────────────────────────────────────────────────

export class HitFeedback {
    constructor(scene) {
        this.sound     = new HitSound();
        this.particles = new HitParticles(scene);
    }

    /**
     * Trigger all feedback for a single hit.
     * @param {THREE.Vector3} position  World-space contact point
     * @param {'light'|'heavy'} type
     * @param {Player} victim           The player/dummy that was hit
     */
    onHit(position, type, victim) {
        this.sound.play(type);
        this.particles.spawn(position, type);
        victim.receiveHit(type);
    }

    /** Call every frame from GameScene.animate(). */
    update(deltaTime) {
        this.particles.update(deltaTime);
    }
}