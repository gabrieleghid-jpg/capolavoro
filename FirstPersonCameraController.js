import * as THREE from 'three';

/**
 * FirstPersonCameraController - Pointer-lock first-person camera.
 * On desktop: click to lock pointer, then move mouse to look around.
 * On mobile: swipe anywhere outside the virtual joystick / buttons.
 *
 * @param {THREE.Camera} camera
 * @param {THREE.Object3D} player
 * @param {HTMLElement} domElement
 * @param {object} options
 * @param {number} [options.eyeHeight=1.6]
 * @param {number} [options.mouseSensitivity=0.002]
 */
export class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera    = camera;
    this.player    = player;
    this.domElement = domElement;

    this.eyeHeight        = options.eyeHeight        || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;

    this.enabled   = false;
    this.rotationY = 0;
    this.rotationX = 0;

    this._originalVisibility = null;

    this._setupMouseControls();
  }

  _setupMouseControls() {
    // Desktop pointer lock
    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;
      this.rotationY -= e.movementX * this.mouseSensitivity;
      this.rotationX -= e.movementY * this.mouseSensitivity;
      this._clampPitch();
    });

    // Touch (mobile) — ignores touches over the virtual joystick / buttons
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      let touchStart = null;

      const overMobileUI = (touch) => {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        return el && (
          el.id === 'mobile-game-controls' ||
          el.id === 'virtual-joystick'     ||
          el.id === 'virtual-joystick-knob'||
          el.id === 'jump-button'          ||
          el.closest('#mobile-game-controls')
        );
      };

      this.domElement.addEventListener('touchstart', (e) => {
        if (!this.enabled || e.touches.length !== 1) return;
        if (overMobileUI(e.touches[0])) return;
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchmove', (e) => {
        if (!this.enabled || !touchStart || e.touches.length !== 1) return;
        if (overMobileUI(e.touches[0])) return;
        const touch  = e.touches[0];
        const deltaX = touch.clientX - touchStart.x;
        const deltaY = touch.clientY - touchStart.y;
        this.rotationY -= deltaX * this.mouseSensitivity * 2;
        this.rotationX -= deltaY * this.mouseSensitivity * 2;
        this._clampPitch();
        touchStart = { x: touch.clientX, y: touch.clientY };
        e.preventDefault();
      });

      this.domElement.addEventListener('touchend', (e) => {
        touchStart = null;
        e.preventDefault();
      });
    }
  }

  _clampPitch() {
    this.rotationX = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.rotationX));
  }

  enable() {
    this.enabled   = true;
    this.rotationX = 0;
    this._hidePlayer();
  }

  disable() {
    this.enabled = false;
    this._showPlayer();
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  _hidePlayer() {
    this._originalVisibility = [];
    this.player.traverse((child) => {
      if (child.isMesh) {
        this._originalVisibility.push({ object: child, visible: child.visible });
        child.visible = false;
      }
    });
  }

  _showPlayer() {
    if (!this._originalVisibility) return;
    this._originalVisibility.forEach(({ object, visible }) => {
      object.visible = visible;
    });
    this._originalVisibility = null;
  }

  /**
   * Call once per frame inside the render loop.
   * @returns {number} Current horizontal rotation (yaw) in radians.
   */
  update() {
    if (!this.enabled) return 0;

    this.player.rotation.y = this.rotationY;

    this.camera.position.x = this.player.position.x;
    this.camera.position.y = this.player.position.y + this.eyeHeight;
    this.camera.position.z = this.player.position.z;

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x    = this.rotationX;
    this.camera.rotation.y    = this.rotationY;

    return this.rotationY;
  }

  destroy() {}
}