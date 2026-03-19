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
        this.addPlatform(0, 0, 0, 60, 1, 60, platformMaterial);

        // Raised platforms
        this.addPlatform(-20, 6, -16, 16, 0.5, 16, platformMaterial);
        this.addPlatform(20, 6, 16, 16, 0.5, 16, platformMaterial);
        this.addPlatform(0, 12, 0, 20, 0.5, 20, platformMaterial);

        // Distant background
        const bgTexture = textureLoader.load(Config.assets.background);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            map: bgTexture,
            color: 0xaaaaaa,
            side: THREE.BackSide
        });
        const bgGeometry = new THREE.SphereGeometry(250, 32, 32);
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        this.add(background);

        // --- DEATH ZONE BARRIERS ---
        const b = Config.arenaBounds;
        const wallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.1, 
            side: THREE.DoubleSide 
        });

        // Wall geometries
        const wallXGeom = new THREE.PlaneGeometry(b.z * 2, b.y * 2);
        const wallZGeom = new THREE.PlaneGeometry(b.x * 2, b.y * 2);

        // Position walls at the boundaries
        // Left
        const leftWall = new THREE.Mesh(wallXGeom, wallMaterial);
        leftWall.position.set(-b.x, b.y / 2, 0);
        leftWall.rotation.y = Math.PI / 2;
        this.add(leftWall);

        // Right
        const rightWall = new THREE.Mesh(wallXGeom, wallMaterial);
        rightWall.position.set(b.x, b.y / 2, 0);
        rightWall.rotation.y = -Math.PI / 2;
        this.add(rightWall);

        // Front
        const frontWall = new THREE.Mesh(wallZGeom, wallMaterial);
        frontWall.position.set(0, b.y / 2, b.z);
        this.add(frontWall);

        // Back
        const backWall = new THREE.Mesh(wallZGeom, wallMaterial);
        backWall.position.set(0, b.y / 2, -b.z);
        this.add(backWall);

        // Glowing Abyss Floor (Death Zone indicator at the bottom)
        const abyssGeom = new THREE.PlaneGeometry(300, 300);
        const abyssMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff3300, 
            transparent: true, 
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        const abyss = new THREE.Mesh(abyssGeom, abyssMaterial);
        abyss.rotation.x = -Math.PI / 2;
        abyss.position.y = -15;
        this.add(abyss);
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
