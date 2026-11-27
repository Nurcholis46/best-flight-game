// config.js — every tuning number for Emberwing Ring Run in one place.
// Distances are in metres, speeds in metres per second unless noted.
// Three missions share this tuning: Ring Run (12 rings), Slalom Sprint
// (8 low pylon gates) and Cargo Drop (crate onto a ground target).

export const WORLD = {
  seaLevel: 0,
  terrainStep: 60,          // legacy reference step (render uses 3 grids)
  terrainRadius: 3000,      // how far terrain is drawn around the plane
  runway: { x: 0, z: 0, heading: 0, length: 900, width: 46 },
  ringCount: 12,
  ringRadius: 26,
  // Fixed sun direction (normalised in render.js) for terrain lighting.
  sunDir: { x: -0.55, y: 0.72, z: 0.42 },
  horizon: [207, 232, 247], // haze colour distant terrain blends toward
};

export const PLANE = {
  maxSpeed: 92,             // m/s at full throttle, level flight
  stallSpeed: 22,           // below this the wing stops lifting
  rotateSpeed: 30,          // takeoff speed on the runway
  maxThrottleRate: 0.55,    // throttle units per second (0..1)
  pitchRate: 0.85,          // rad/s at full stick
  rollRate: 1.9,            // rad/s at full stick
  yawRate: 0.45,            // rad/s from the rudder keys
  turnFromRoll: 0.62,       // heading change per radian of bank
  fuelCapacity: 100,
  fuelBurnIdle: 0.55,       // fuel units per second at idle
  fuelBurnFull: 2.6,        // fuel units per second at full throttle
};

export const GAME = {
  startTime: 150,           // seconds on the clock at takeoff (Ring Run)
  ringTimeBonus: 12,        // seconds added per ring
  ringScore: 250,
  centreBonus: 100,         // extra points for a dead-centre ring pass
  gateScore: 200,           // Slalom Sprint gate
  gateTimeBonus: 6,         // seconds added per slalom gate
  slalomTime: 95,           // shorter clock for the sprint
  cargoTime: 130,           // clock for Cargo Drop
  cargoMaxScore: 1000,      // dead-centre crate score, falls off with distance
  cargoFalloff: 7,          // points lost per metre from the target centre
  comboWindow: 12,          // seconds between scores to keep a combo alive
  landingScore: 500,
  perfectLandingScore: 900,
  maxHull: 100,
};

export const COLORS = {
  skyTop: '#24508f',
  skyMid: '#5f9fd8',
  skyLow: '#cfe8f7',
  sun: '#fff3c4',
  sea: '#2e6da8',
  seaDeep: '#24567f',
  sand: '#d9c27a',
  grass: '#5da85c',
  grassDark: '#3f7d44',
  rock: '#8a8378',
  snow: '#f4f7fa',
  runway: '#3a3f46',
  runwayLine: '#f5f5f0',
  ringNext: '#ffd23f',
  ringDone: '#3ddc84',
  ringTodo: '#7fd4ff',
  hud: '#eaf6ff',
  hudDim: 'rgba(234,246,255,0.65)',
  hudAccent: '#ffd23f',
  danger: '#ff5a5a',
  panel: 'rgba(8,16,30,0.72)',
  panelEdge: 'rgba(160,210,255,0.45)',
};
