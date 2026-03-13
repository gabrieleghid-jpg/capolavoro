import * as THREE from 'three';
import { Config } from './Config.js';

export class Player extends THREE.Group {
    constructor(id, color, initialX) {
        super();
        this.playerId = id;
        this.color = color;

        // Visuals
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

        // Hitbox visual
        this.hitboxMesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, visible: false })
        );
        this.add(this.hitboxMesh);

        // Physics
        this.position.set(initialX, 5, 0);
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.jumpsLeft = 2;
        this.dashCooldown = 0;
        
        // Combat
        this.damage = 0;
        this.isStunned = false;
        this.stunTimer = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.attackTimer = 0;
        this.isAttacking = false;
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
        if (down) moveZ += Config.moveSpeed;

        this.velocity.x += moveX;
        this.velocity.z += moveZ;

        // Visual Rotation
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
        }
    }

    dash() {
        if (this.isStunned || this.dashCooldown > 0) return;
        this.isDashing = true;
        this.dashTimer = 0.2;
        this.dashCooldown = 0.8;
        
        const dashDir = new THREE.Vector3(this.velocity.x, 0, this.velocity.z).normalize();
        if (dashDir.lengthSq() < 0.1) dashDir.set(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));

        this.velocity.x = dashDir.x * Config.dashForce * 2.5;
        this.velocity.z = dashDir.z * Config.dashForce * 2.5;
        this.velocity.y = 0;
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
    }

    update(deltaTime, platforms) {
        if (!this.isGrounded && !this.isDashing) {
            this.velocity.y += Config.gravity;
        }

        const drag = this.isGrounded ? Config.drag : Config.airDrag;
        this.velocity.x *= drag;
        this.velocity.z *= drag;
        if (!this.isDashing) this.velocity.y *= 0.98;

        if (this.isDashing) {
            this.dashTimer -= deltaTime;
            if (this.dashTimer <= 0) this.isDashing = false;
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.position.z += this.velocity.z;

        this.isGrounded = false;
        for (const platform of platforms) {
            if (this.checkCollision(platform)) {
                const platTop = platform.position.y + platform.geometry.parameters.height / 2;
                if (this.velocity.y <= 0 && this.position.y - 0.5 > platTop - 0.5) {
                    this.position.y = platTop + 1.01;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    this.jumpsLeft = 2;
                }
            }
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

    checkCollision(platform) {
        const p1 = {
            minX: this.position.x - 0.6, maxX: this.position.x + 0.6,
            minY: this.position.y - 1, maxY: this.position.y + 1,
            minZ: this.position.z - 0.6, maxZ: this.position.z + 0.6
        };
        const p2 = {
            minX: platform.position.x - platform.geometry.parameters.width / 2,
            maxX: platform.position.x + platform.geometry.parameters.width / 2,
            minY: platform.position.y - platform.geometry.parameters.height / 2,
            maxY: platform.position.y + platform.geometry.parameters.height / 2,
            minZ: platform.position.z - platform.geometry.parameters.depth / 2,
            maxZ: platform.position.z + platform.geometry.parameters.depth / 2
        };

        return p1.minX < p2.maxX && p1.maxX > p2.minX && 
               p1.minY < p2.maxY && p1.maxY > p2.minY &&
               p1.minZ < p2.maxZ && p1.maxZ > p2.minZ;
    }

    respawn() {
        this.position.set(Math.random() * 10 - 5, 15, Math.random() * 10 - 5);
        this.velocity.set(0, 0, 0);
        this.damage = 0;
        this.isStunned = false;
        this.jumpsLeft = 2;
    }
}
