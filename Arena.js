import * as THREE from 'three';

import { Config } from './Config.js';  

export class Arena extends THREE.Group {

    constructor() {

        super();

        this.platforms = [];

        this.init(); //

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

        // Pavimento principale (ingrandito a 170x170)

        this.addPlatform(0, 0, 0, 170, 1, 170, platformMaterial);

        // Piattaforme rialzate (spostate più in alto e ingrandite a 35x35)

        this.addPlatform(-40, 15, -30, 35, 1, 35, platformMaterial);

        this.addPlatform(40, 15, 30, 35, 1, 35, platformMaterial);

        // Piattaforma centrale (più alta a y=22 e ingrandita a 40x40)

        this.addPlatform(0, 22, 0, 40, 1, 40, platformMaterial);

        // Distant background (sfera ingrandita per contenere la nuova arena)

        const bgTexture = textureLoader.load(Config.assets.background);

        const bgMaterial = new THREE.MeshBasicMaterial({

            map: bgTexture,

            color: 0xaaaaaa,

            side: THREE.BackSide

        });

        const bgGeometry = new THREE.SphereGeometry(250, 32, 32);

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
 