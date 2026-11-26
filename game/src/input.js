// input.js — keyboard and mouse state for Emberwing Ring Run.
// The game reads a plain `controls` object every frame; this module keeps it
// up to date from DOM events and exposes one-shot key presses for menus.

export const controls = {
  pitch: 0,      // -1 nose down .. +1 nose up
  roll: 0,       // -1 bank left .. +1 bank right
  yaw: 0,        // -1 rudder left .. +1 rudder right
  throttleUp: false,
  throttleDown: false,
  brake: false,
  mouseSteer: false,
  mouseX: 0,     // -1..1 across the canvas
  mouseY: 0,     // -1..1 down the canvas
};

const pressed = new Set();
const justPressed = new Set();

const KEYMAP = {
  ArrowUp: 'pitchDown', KeyW: 'pitchDown',
  ArrowDown: 'pitchUp', KeyS: 'pitchUp',
  ArrowLeft: 'rollLeft', KeyA: 'rollLeft',
  ArrowRight: 'rollRight', KeyD: 'rollRight',
  KeyQ: 'yawLeft', KeyE: 'yawRight',
  ShiftLeft: 'throttleUp', ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown', ControlRight: 'throttleDown',
  Space: 'brake',
};

function refreshAxes() {
  controls.pitch = (pressed.has('pitchUp') ? 1 : 0) - (pressed.has('pitchDown') ? 1 : 0);
  controls.roll = (pressed.has('rollRight') ? 1 : 0) - (pressed.has('rollLeft') ? 1 : 0);
  controls.yaw = (pressed.has('yawRight') ? 1 : 0) - (pressed.has('yawLeft') ? 1 : 0);
  controls.throttleUp = pressed.has('throttleUp');
  controls.throttleDown = pressed.has('throttleDown');
  controls.brake = pressed.has('brake');
}

export function installInput(canvas) {
  window.addEventListener('keydown', (event) => {
    const action = KEYMAP[event.code];
    if (action) {
      pressed.add(action);
      refreshAxes();
      event.preventDefault();
    }
    if (!event.repeat) justPressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) {
      pressed.delete(action);
      refreshAxes();
      event.preventDefault();
    }
  });
  window.addEventListener('blur', () => {
    pressed.clear();
    refreshAxes();
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    controls.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    controls.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  });
  canvas.addEventListener('pointerdown', () => { controls.mouseSteer = true; });
  window.addEventListener('pointerup', () => { controls.mouseSteer = false; });
}

// True once per physical key press; consumed by the caller.
export function wasPressed(code) {
  if (justPressed.has(code)) {
    justPressed.delete(code);
    return true;
  }
  return false;
}

export function clearPresses() {
  justPressed.clear();
}
