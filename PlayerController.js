import * as THREE from 'three';
import { MobileControls } from './rosieMobileControls.js';

/**
 * PlayerController - Handles player movement and physics
 */
export class PlayerController {
  constructor(player, options = {}) {
    this.player = player;

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1;

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.cameraMode = 'third-person';

    this.setupInput();
    this.mobileControls = new MobileControls(this);
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  /**
   * Updates the player's state, velocity, and position.
   * @param {number} deltaTime Time elapsed since the last frame.
   * @param {number} cameraRotation The current horizontal rotation (yaw) of the active camera.
   */
  update(deltaTime, cameraRotation) {
    // Apply gravity
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * deltaTime;
      this.isOnGround = false;
    } else {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true;
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false;
    }

    // Horizontal movement
    let moveX = 0;
    let moveZ = 0;

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
    const right   = new THREE.Vector3(1, 0,  0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

    if (this.keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
    if (this.keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.keys['KeyA']) { moveX -= right.x;   moveZ -= right.z;   }
    if (this.keys['KeyD']) { moveX += right.x;   moveZ += right.z;   }

    const moveDirection = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDirection.lengthSq() > 0) moveDirection.normalize();

    this.velocity.x = moveDirection.x * this.moveSpeed;
    this.velocity.z = moveDirection.z * this.moveSpeed;

    // Update position
    this.player.position.x += this.velocity.x * deltaTime;
    this.player.position.y += this.velocity.y * deltaTime;
    this.player.position.z += this.velocity.z * deltaTime;

    // Update rotation (third-person only)
    if (this.cameraMode === 'third-person' && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      const angle = Math.atan2(this.velocity.x, this.velocity.z);
      this.player.rotation.y = angle;
    }
  }

  destroy() {
    this.mobileControls.destroy();
  }
}