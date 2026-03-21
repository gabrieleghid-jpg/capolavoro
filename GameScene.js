import * as THREE from 'three';
import { Player } from './Player.js';
import { Arena } from './Arena.js';
import { Config } from './Config.js';

export class GameScene {
    constructor(container) {
        this.container = container;
        this.init();
    }

    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.008);

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 30, 50);
        this.camera.lookAt(0, 0, 0);

        try {
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: window.devicePixelRatio < 2, // Disable antialias on high DPI for performance
                powerPreference: "high-performance" 
            });
        } catch (e) {
            console.error("WebGL initialization failed, trying without antialias", e);
            this.renderer = new THREE.WebGLRenderer();
        }

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Brighter Lights
        const ambient = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambient);

        const moonLight = new THREE.DirectionalLight(0xccccff, 2.5);
        moonLight.position.set(20, 50, 30);
        moonLight.castShadow = true;
        this.scene.add(moonLight);

        // Accent lights
        const orangeLight = new THREE.PointLight(0xffaa00, 20, 50);
        orangeLight.position.set(0, 5, 0);
        this.scene.add(orangeLight);

        // Arena
        this.arena = new Arena();
        this.scene.add(this.arena);

        // Players
        this.player1 = new Player(1, Config.colors.player1, -8);
        this.player2 = new Player(2, Config.colors.player2, 8);
        this.scene.add(this.player1);
        this.scene.add(this.player2);

        // Input
        this.keys = {};

        window.addEventListener('keydown', (e) => {
            // Prevent Space/Arrow keys from scrolling the page (causes black screen)
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }

            // Only trigger one-shot actions on the first keydown (not held)
            if (!this.keys[e.code]) {
                this.handlePlayerAction(e.code);
            }

            this.keys[e.code] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousedown', (e) => {
            if (e.button === 0) this.player1.attack();
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        this.clock = new THREE.Clock();
        this.animate();
    }

    handlePlayerAction(code) {
        // Jump: Space or W (only upward, ArrowUp is now movement)
        if (code === 'Space') this.player1.jump();
        // Dash: Shift or E
        if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyE') this.player1.dash();
        // Attack: F or Z
        if (code === 'KeyF' || code === 'KeyZ') this.player1.attack();
    }

    // AI completamente disabilitata — player2 rimane fermo
    updateAI(deltaTime) {
        // nessun movimento, nessun attacco
    }

    checkAttacks() {
        // Solo player1 può colpire player2, non viceversa
        this.checkPlayerAttack(this.player1, this.player2);
    }

    checkPlayerAttack(attacker, victim) {
        if (!attacker.isAttacking) return;
        
        const hitboxPos = new THREE.Vector3().copy(attacker.hitboxMesh.position).applyMatrix4(attacker.matrixWorld);
        const dist = hitboxPos.distanceTo(victim.position);

        if (dist < 2.5) {
            victim.damage += 15;
            victim.applyKnockback(0.45, attacker.position);
            this.createHitEffect(victim.position);
            attacker.isAttacking = false;
        }
    }

    createHitEffect(pos) {
        const flare = new THREE.PointLight(0xffffff, 15, 10);
        flare.position.copy(pos);
        this.scene.add(flare);
        setTimeout(() => this.scene.remove(flare), 100);
    }

    updateUI() {
        const p1Div = document.getElementById('p1-damage');
        const p2Div = document.getElementById('p2-damage');
        if (p1Div) p1Div.innerText = `${Math.floor(this.player1.damage)}%`;
        if (p2Div) p2Div.innerText = `${Math.floor(this.player2.damage)}%`;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = Math.min(this.clock.getDelta(), 0.1);

        this.player1.handleInput(this.keys);
        this.updateAI(deltaTime);

        this.player1.update(deltaTime, this.arena.platforms);
        this.player2.update(deltaTime, this.arena.platforms);

        this.checkAttacks();
        this.updateUI();

        // Dynamic 3D Camera
        const midPoint = new THREE.Vector3().addVectors(this.player1.position, this.player2.position).multiplyScalar(0.5);
        const dist = this.player1.position.distanceTo(this.player2.position);
        
        const idealOffset = new THREE.Vector3(0, 15 + dist * 0.5, 25 + dist * 0.8);
        const targetPos = midPoint.clone().add(idealOffset);
        
        this.camera.position.lerp(targetPos, 0.05);
        this.camera.lookAt(midPoint.x, midPoint.y + 2, midPoint.z);

        this.renderer.render(this.scene, this.camera);
    }
}