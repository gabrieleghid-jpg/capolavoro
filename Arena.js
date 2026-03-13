import * as THREE from 'three';
import { Config } from './Config.js';

export class Arena extends THREE.Group {
    constructor() {
        super();
        this.platforms = [];
        this.init();
    }

    init() {
        // Textures
        const textureLoader = new THREE.TextureLoader();
        const stoneTexture = textureLoader.load(Config.assets.stoneTexture);
        stoneTexture.wrapS = stoneTexture.wrapT = THREE.RepeatWrapping;

        const platformMaterial = new THREE.MeshStandardMaterial({ 
            map: stoneTexture,
            roughness: 0.6,
            metalness: 0.3,
            color: 0x888888
        });

        // Main floor
        this.addPlatform(0, 0, 0, 30, 1, 30, platformMaterial);

        // Raised platforms
        this.addPlatform(-10, 6, -8, 8, 0.5, 8, platformMaterial);
        this.addPlatform(10, 6, 8, 8, 0.5, 8, platformMaterial);
        this.addPlatform(0, 12, 0, 10, 0.5, 10, platformMaterial);

        // Distant background
        const bgTexture = textureLoader.load(Config.assets.background);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            map: bgTexture,
            color: 0xaaaaaa,
            side: THREE.BackSide
        });
        const bgGeometry = new THREE.SphereGeometry(150, 32, 32);
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        this.add(background);
    }

    addPlatform(x, y, z, w, h, d, material) {
        const geometry = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.add(mesh);
        this.platforms.push(mesh);
    }
}
