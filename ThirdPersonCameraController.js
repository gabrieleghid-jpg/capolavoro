import * as THREE from 'three';

/**
 * ThirdPersonCameraController - Handles third-person camera positioning and rotation.
 * Drag with mouse (or swipe on mobile) to orbit around the target.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} target  - Object the camera follows (usually the player mesh)
 * @param {HTMLElement} domElement - Renderer DOM element (for pointer events)
 * @param {object} options
 * @param {number} [options.distance=7]       - Orbit radius
 * @param {number} [options.height=3]         - Camera height offset
 * @param {number} [options.rotationSpeed=0.003]
 */
export class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    this.distance      = options.distance      || 7;
    this.height        = options.height        || 3;
    this.rotationSpeed = options.rotationSpeed || 0.003;

    this.rotation    = 0;
    this.isDragging  = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled     = true;

    this._setupMouseControls();
  }

  _setupMouseControls() {
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isDragging) return;
      const deltaX = e.clientX - this.mousePosition.x;
      this.rotation -= deltaX * this.rotationSpeed;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    // Touch (mobile)
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;

      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;
        const touch  = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        this.rotation -= deltaX * this.rotationSpeed * 2;
        touchStart = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchend', (e) => {
        touchStart = null;
        e.preventDefault();
      });
    }
  }

  enable()  { this.enabled = true;  }
  disable() { this.enabled = false; this.isDragging = false; }

  /**
   * Call once per frame inside the render loop.
   * @returns {number} Current horizontal rotation (yaw) in radians — pass this to PlayerController.update().
   */
  update() {
    if (!this.enabled) return 0;

    const offset = new THREE.Vector3(
      Math.sin(this.rotation) * this.distance,
      this.height,
      Math.cos(this.rotation) * this.distance
    );

    this.camera.position.copy(this.target.position).add(offset);
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );

    return this.rotation;
  }

  destroy() {}
}