/**
 * rosieControls.js — barrel file
 *
 * Importa da qui esattamente come prima:
 *   import { PlayerController } from './rosie/controls/rosieControls.js';
 *
 * I sorgenti sono ora separati in:
 *   PlayerController.js
 *   ThirdPersonCameraController.js
 *   FirstPersonCameraController.js
 */
export { PlayerController }            from './PlayerController.js';
export { ThirdPersonCameraController } from './ThirdPersonCameraController.js';
export { FirstPersonCameraController } from './FirstPersonCameraController.js';