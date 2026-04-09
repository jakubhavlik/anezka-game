// ============================================================
//  ANEZKA GAME  –  2D Retro Side-Scroller  (Three.js + Vite)
//  Kind of made by a 9-year-old  🎮
// ============================================================
import './style.css';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS  (tune everything from here)
// ─────────────────────────────────────────────────────────────
const C = {
  // World
  SCREEN_W: 20,          // orthographic units visible horizontally
  SCREEN_H: 12,          // orthographic units visible vertically
  WORLD_SCREENS_W: 4,    // level is 4 screens wide (cozy town square)
  WORLD_SCREENS_H: 3,    // level is 3 screens tall
  FLOOR_Y: -4.5,         // y-position of the floor top surface

  // Physics
  GRAVITY: -28,
  JUMP_VY: 15,
  MOVE_SPD: 7,
  FLY_SPD: 6,
  FLY_THRUST: 9,         // vertical speed when Space held (flying char)
  FLY_DAMP: 0.88,        // Y-velocity damping each frame for flyer
  MAX_FALL: -22,
  ATTACK_RANGE: 1.6,     // horizontal reach of melee attack
  ATTACK_COOLDOWN: 0.45, // seconds between attacks
  ENEMY_SPD: 2.5,
  KNOCKBACK_VX: 6,
  KNOCKBACK_VY: 4,

  // Party leash
  LEASH_FRAMES: 10,      // followers track position 10 samples ago
  LEASH_LERP: 0.25,      // lerp factor toward history target

  // Camera
  CAM_LERP: 0.1,
  CAM_DEAD_X: 2,         // half dead-zone width before cam moves

  // Parallax multipliers (fraction of camera dx applied each frame)
  PAR_FAR:  0.15,
  PAR_MID:  0.40,
  PAR_ACT:  1.00,        // action plane = world, moves 1:1

  // DT safety clamp
  MAX_DT: 0.033,

  // Health
  LEADER_MAX_HP: 10,
  ENEMY_MAX_HP: 2,
};

const WORLD_W = C.SCREEN_W * C.WORLD_SCREENS_W;  // 80 units
const WORLD_H = C.SCREEN_H * C.WORLD_SCREENS_H;   // 36 units

// ─────────────────────────────────────────────────────────────
//  DOM SETUP  (inject the UI shell, mount canvas into #app)
// ─────────────────────────────────────────────────────────────
document.querySelector('#app').innerHTML = `
  <div id="ui">
    <div id="hearts"></div>
    <div id="leader-badge">LEADER</div>
    <div id="mute-badge">🔊</div>
    <div id="modal">
      <h1 id="modal-title">ANEZKA GAME</h1>
      <p id="modal-msg">Press any key or tap to start!</p>
    </div>
    <div id="controls-hint">WASD / Space = jump | Tab = switch hero | F = attack | Esc = pause | M = mute</div>
  </div>
`;
const uiEl      = document.getElementById('ui');
const heartsEl  = document.getElementById('hearts');
const badgeEl   = document.getElementById('leader-badge');
const muteBadge = document.getElementById('mute-badge');
const modalEl   = document.getElementById('modal');
const modalTitle= document.getElementById('modal-title');
const modalMsg  = document.getElementById('modal-msg');

// ─────────────────────────────────────────────────────────────
//  RENDERER + SCENE + CAMERA
// ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfdcf4);

// Orthographic camera: left/right/top/bottom in world units
function makeOrtho() {
  const aspect = window.innerWidth / window.innerHeight;
  const hw = C.SCREEN_W / 2;
  const hh = hw / aspect;
  return new THREE.OrthographicCamera(-hw, hw, hh, -hh, -100, 100);
}
let camera = makeOrtho();
camera.position.z = 10;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  const c2 = makeOrtho();
  camera.left  = c2.left;  camera.right = c2.right;
  camera.top   = c2.top;   camera.bottom = c2.bottom;
  camera.updateProjectionMatrix();
});

// ─────────────────────────────────────────────────────────────
//  AUDIO  (simple preloaded tones via Web Audio, no files needed)
// ─────────────────────────────────────────────────────────────
let audioCtx = null;
let muted = false;

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, type, duration, vol = 0.18) {
  if (muted) return;
  ensureAudio();
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(vol, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

const SFX = {
  jump:    () => playTone(420, 'square',   0.12),
  attack:  () => playTone(200, 'sawtooth', 0.09),
  hit:     () => playTone(120, 'square',   0.15),
  defeat:  () => { playTone(180, 'sawtooth', 0.3); setTimeout(() => playTone(100, 'sawtooth', 0.4), 150); },
  menu:    () => playTone(660, 'sine',     0.08),
  thud:    () => playTone(80,  'square',   0.10, 0.25),
};

// ─────────────────────────────────────────────────────────────
//  INPUT  (key set, edge-detect for Tab + F)
// ─────────────────────────────────────────────────────────────
const keys   = new Set();
const justDown = new Set();

window.addEventListener('keydown', e => {
  if (!keys.has(e.code)) justDown.add(e.code);
  keys.add(e.code);
  // prevent browser scroll on arrow/space
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
});

function consumeJust(code) {
  const had = justDown.has(code);
  justDown.delete(code);
  return had;
}

// ─────────────────────────────────────────────────────────────
//  COLOUR HELPER  (placeholder textures via Canvas2D)
// ─────────────────────────────────────────────────────────────
const _texCache = {};
function solidTex(color, w = 64, h = 64) {
  const key = `${color}_${w}_${h}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  // simple 2px inner border for visual separation
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function hazeTex() {
  const key = 'haze_tex_v1';
  if (_texCache[key]) return _texCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0.0, 'rgba(219, 232, 246, 0.00)');
  g.addColorStop(0.45, 'rgba(202, 220, 240, 0.12)');
  g.addColorStop(1.0, 'rgba(183, 206, 230, 0.24)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function cloudStripTex() {
  const key = 'cloud_strip_tex_v1';
  if (_texCache[key]) return _texCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // soft cloud blobs, sparse and calm
  for (let i = 0; i < 20; i++) {
    const x = 40 + i * 50 + (i % 3) * 10;
    const y = 52 + (i % 4) * 12;
    const r = 20 + (i % 5) * 4;
    const alpha = 0.28 - (i % 3) * 0.05;

    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(Math.ceil(WORLD_W / 40), 1);
  _texCache[key] = tex;
  return tex;
}

function buildingFacadeTex({ body = '#7f94b2', roof = '#657c9d', windowOn = '#f7ddb2', windowOff = '#a6bdd7', cols = 5, rows = 8, seed = 1 }) {
  const key = `bld_${body}_${roof}_${windowOn}_${windowOff}_${cols}_${rows}_${seed}`;
  if (_texCache[key]) return _texCache[key];

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = body;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = roof;
  ctx.fillRect(0, 0, canvas.width, 16);

  // deterministic pseudo-random lights from seed so facades vary but are stable
  let rng = seed * 9301 + 49297;
  const rand = () => {
    rng = (rng * 233280 + 12345) % 0x7fffffff;
    return (rng & 0xffff) / 0xffff;
  };

  const padX = 8;
  const padY = 22;
  const cellW = (canvas.width - padX * 2) / cols;
  const cellH = (canvas.height - padY * 2) / rows;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      // Leave some slots empty so facades feel calmer and less dense.
      if (rand() > 0.72) continue;
      const wx = Math.floor(padX + x * cellW + 4);
      const wy = Math.floor(padY + y * cellH + 4);
      const ww = Math.max(5, Math.floor(cellW - 8));
      const wh = Math.max(8, Math.floor(cellH - 8));
      const lit = rand() > 0.82;
      ctx.fillStyle = lit ? windowOn : windowOff;
      ctx.fillRect(wx, wy, ww, wh);
    }
  }

  // door strip at bottom to read as a building near street level
  ctx.fillStyle = '#6c7d90';
  ctx.fillRect(canvas.width * 0.35, canvas.height - 28, canvas.width * 0.3, 22);

  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function streetTex() {
  const key = 'street_tex_v2';
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  // cobblestone-like base
  ctx.fillStyle = '#b5afa6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // curb
  ctx.fillStyle = '#d4cfc5';
  ctx.fillRect(0, 0, canvas.width, 8);
  // subtle stone pattern
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 18) {
    for (let y = 10; y < canvas.height; y += 12) {
      ctx.strokeRect(x + ((y / 12) % 2) * 9, y, 18, 12);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.ceil(WORLD_W / 10), 1);
  _texCache[key] = tex;
  return tex;
}

// ── New texture generators for town-square scenery ──────────

function awningTex(color1 = '#cc4444', color2 = '#ffffff') {
  const key = `awning_${color1}_${color2}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const stripeW = 16;
  for (let x = 0; x < canvas.width; x += stripeW * 2) {
    ctx.fillStyle = color1; ctx.fillRect(x, 0, stripeW, canvas.height);
    ctx.fillStyle = color2; ctx.fillRect(x + stripeW, 0, stripeW, canvas.height);
  }
  // bottom scallop edge
  ctx.fillStyle = color1;
  for (let x = 0; x < canvas.width; x += 12) {
    ctx.beginPath(); ctx.arc(x + 6, canvas.height - 2, 5, 0, Math.PI); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function rooftopTex(color = '#b07050') {
  const key = `roof_${color}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 24;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // tile rows
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 6) {
    const off = (y / 6) % 2 === 0 ? 0 : 8;
    for (let x = off; x < canvas.width; x += 16) {
      ctx.strokeRect(x, y, 16, 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function ledgeTex(color = '#c8bfb0') {
  const key = `ledge_${color}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // shadow line at bottom
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, canvas.height - 3, canvas.width, 3);
  // highlight at top
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, 0, canvas.width, 2);
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function shopFrontTex({ wall = '#d4c4a0', trim = '#8b7355', windowColor = '#c8dce8', doorColor = '#6b5040', signColor = '#e8d8b0', seed = 1 }) {
  const key = `shop_${wall}_${trim}_${seed}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  // wall
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // trim band at top
  ctx.fillStyle = trim;
  ctx.fillRect(0, 0, canvas.width, 10);
  // large display window
  ctx.fillStyle = windowColor;
  ctx.fillRect(10, 30, canvas.width - 20, 55);
  // window frame
  ctx.strokeStyle = trim;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 30, canvas.width - 20, 55);
  // vertical divider
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 30);
  ctx.lineTo(canvas.width / 2, 85);
  ctx.stroke();
  // door
  ctx.fillStyle = doorColor;
  ctx.fillRect(canvas.width * 0.38, canvas.height - 38, canvas.width * 0.24, 36);
  // sign area
  ctx.fillStyle = signColor;
  ctx.fillRect(20, 12, canvas.width - 40, 14);
  ctx.strokeStyle = trim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 12, canvas.width - 40, 14);
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function mountainTex(color = '#9db8d4', snowColor = '#e8f0f8') {
  const key = `mtn_${color}_${snowColor}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // mountain body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  ctx.lineTo(canvas.width * 0.5, 20);
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();
  // snow cap
  ctx.fillStyle = snowColor;
  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.35, canvas.height * 0.35);
  ctx.lineTo(canvas.width * 0.5, 20);
  ctx.lineTo(canvas.width * 0.65, canvas.height * 0.35);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

function treeTex(trunk = '#8b7355', leaf = '#6aaa55') {
  const key = `tree_${trunk}_${leaf}`;
  if (_texCache[key]) return _texCache[key];
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // trunk
  ctx.fillStyle = trunk;
  ctx.fillRect(26, 56, 12, 40);
  // crown (three overlapping circles)
  ctx.fillStyle = leaf;
  ctx.beginPath(); ctx.arc(32, 36, 22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(20, 44, 16, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(44, 44, 16, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  _texCache[key] = tex;
  return tex;
}

// Wing texture: body + two wing blobs
function wingTex(bodyColor, wingColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  // body
  ctx.fillStyle = bodyColor;
  ctx.fillRect(20, 16, 24, 32);
  // wings
  ctx.fillStyle = wingColor;
  ctx.fillRect(2,  20, 18, 20);
  ctx.fillRect(44, 20, 18, 20);
  // eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(26, 22, 5, 5);
  ctx.fillRect(34, 22, 5, 5);
  ctx.fillStyle = '#000';
  ctx.fillRect(28, 23, 3, 3);
  ctx.fillRect(36, 23, 3, 3);
  return new THREE.CanvasTexture(canvas);
}

// ─────────────────────────────────────────────────────────────
//  AABB HELPER
// ─────────────────────────────────────────────────────────────
// Returns { x, y, hw, hh } bounding box centred on position
function aabb(pos, hw, hh) { return { x: pos.x, y: pos.y, hw, hh }; }
function aabbOverlap(a, b) {
  return Math.abs(a.x - b.x) < a.hw + b.hw &&
         Math.abs(a.y - b.y) < a.hh + b.hh;
}

// ─────────────────────────────────────────────────────────────
//  PLATFORM CLASS
// ─────────────────────────────────────────────────────────────
class Platform {
  constructor(x, y, w, h, color = '#9ea88f') {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.hw = w / 2; this.hh = h / 2;
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({ map: solidTex(color, 128, 32) });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, y, 0);
    scene.add(this.mesh);
  }
}

// ─────────────────────────────────────────────────────────────
//  CHARACTER CLASS
// ─────────────────────────────────────────────────────────────
const CHAR_DEF = [
  { name: 'ALADDIN', color: '#e8a030', type: 'ground' },
  { name: 'ABU',     color: '#c05010', type: 'ground' },
  { name: 'JASMINE', color: '#30a0e8', type: 'ground' },
  { name: 'CARPET',  color: '#9030e0', type: 'fly',    bodyColor: '#9030e0', wingColor: '#e070ff' },
];
const CHAR_HW = 0.5;  // half-width
const CHAR_HH = 0.65; // half-height

class Character {
  constructor(def, startX) {
    this.name  = def.name;
    this.type  = def.type;         // 'ground' | 'fly'
    this.vx    = 0;
    this.vy    = 0;
    this.grounded = false;
    this.hp    = C.LEADER_MAX_HP;
    this.attackCooldown = 0;
    this.knockbackTimer = 0;
    this.facingRight = true;
    this.animTime = 0;             // used by animation oscillator

    // Sprite
    const spriteMat = new THREE.SpriteMaterial({
      map: def.type === 'fly'
        ? wingTex(def.bodyColor, def.wingColor)
        : solidTex(def.color),
      transparent: false,
    });
    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.scale.set(CHAR_HW * 2 + 0.1, CHAR_HH * 2 + 0.4, 1);
    this.sprite.position.set(startX, 2, 1);
    scene.add(this.sprite);

    // Attack flash sprite (thin horizontal rect, hidden by default)
    const atkMat = new THREE.SpriteMaterial({ map: solidTex('#ffff00', 32, 8), transparent: true, opacity: 0 });
    this.atkSprite = new THREE.Sprite(atkMat);
    this.atkSprite.scale.set(C.ATTACK_RANGE * 1.4, 0.3, 1);
    this.atkSprite.position.set(startX, 2, 0.5);
    scene.add(this.atkSprite);

    // Leash history buffer: circular array of {x,y}
    this.history = [];
    const pos = { x: startX, y: 2 };
    for (let i = 0; i < C.LEASH_FRAMES + 5; i++) this.history.push({ ...pos });
    this.histIdx = 0;
  }

  get pos() { return this.sprite.position; }

  // Push current position into the circular history buffer
  recordHistory() {
    this.history[this.histIdx] = { x: this.pos.x, y: this.pos.y };
    this.histIdx = (this.histIdx + 1) % this.history.length;
  }

  // Returns the position stored N frames ago
  historyAt(framesAgo) {
    const len = this.history.length;
    const idx = ((this.histIdx - framesAgo - 1) % len + len) % len;
    return this.history[idx];
  }
}

// ─────────────────────────────────────────────────────────────
//  ENEMY CLASS
// ─────────────────────────────────────────────────────────────
class Enemy {
  constructor(x, y, minX, maxX, color = '#e03030') {
    this.minX = minX; this.maxX = maxX;
    this.vx = C.ENEMY_SPD;
    this.vy = 0;
    this.grounded = false;
    this.hp = C.ENEMY_MAX_HP;
    this.dead = false;
    this.knockbackTimer = 0;
    const mat = new THREE.SpriteMaterial({ map: solidTex(color, 56, 56) });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(1.1, 1.1, 1);
    this.sprite.position.set(x, y, 1);
    scene.add(this.sprite);
    // eyes
    const eMat = new THREE.SpriteMaterial({ map: solidTex('#fff', 16, 8) });
    this.eyeSprite = new THREE.Sprite(eMat);
    this.eyeSprite.scale.set(0.6, 0.25, 1);
    this.eyeSprite.position.set(x, y + 0.25, 1.1);
    scene.add(this.eyeSprite);
  }

  get pos() { return this.sprite.position; }

  remove() {
    scene.remove(this.sprite);
    scene.remove(this.eyeSprite);
    this.dead = true;
  }
}

// ─────────────────────────────────────────────────────────────
//  BUILDING COMPOSER  –  facade (visual) + collision platforms
// ─────────────────────────────────────────────────────────────
function createBuilding({ x, w, stories, style = 'residential', roofColor, bodyColor, awningColor, awningColor2, seed = 1 }) {
  const storyH = 1.6;
  const h = stories * storyH;
  const baseY = C.FLOOR_Y + h / 2;

  // facade body (visual only, z = -0.1)
  const facadePalette = {
    residential: { body: bodyColor || '#d6cbb8', roof: roofColor || '#b07050', windowOn: '#f7ddb2', windowOff: '#c8d4de' },
    shop:        { body: bodyColor || '#e8dcc4', roof: roofColor || '#9b7c5a', windowOn: '#d4e6f0', windowOff: '#c0cdd6' },
    cafe:        { body: bodyColor || '#e0d0b4', roof: roofColor || '#c06040', windowOn: '#daeaf0', windowOff: '#c4d0d8' },
    tall:        { body: bodyColor || '#c8bca8', roof: roofColor || '#8a6844', windowOn: '#f0e0c4', windowOff: '#bcc8d4' },
  };
  const pal = facadePalette[style] || facadePalette.residential;

  const facadeTex = buildingFacadeTex({
    body: pal.body, roof: pal.roof,
    windowOn: pal.windowOn, windowOff: pal.windowOff,
    cols: Math.max(2, Math.round(w / 1.5)),
    rows: Math.min(stories, 6),
    seed,
  });
  const facadeGeo = new THREE.PlaneGeometry(w, h);
  const facadeMat = new THREE.MeshBasicMaterial({ map: facadeTex });
  const facade = new THREE.Mesh(facadeGeo, facadeMat);
  facade.position.set(x, baseY, -0.1);
  scene.add(facade);

  // ground-floor shop front overlay for shop/cafe styles
  if (style === 'shop' || style === 'cafe') {
    const sfTex = shopFrontTex({ wall: pal.body, trim: pal.roof, seed });
    const sfGeo = new THREE.PlaneGeometry(w, storyH);
    const sfMat = new THREE.MeshBasicMaterial({ map: sfTex });
    const sf = new THREE.Mesh(sfGeo, sfMat);
    sf.position.set(x, C.FLOOR_Y + storyH / 2, -0.05);
    scene.add(sf);
  }

  const result = { x, w, h, stories, platforms: [] };

  // ── Rooftop platform ──────────────────────────────────
  const roofPlat = new Platform(x, C.FLOOR_Y + h + 0.15, w + 0.3, 0.35);
  roofPlat.mesh.material.map = rooftopTex(pal.roof);
  roofPlat.mesh.material.needsUpdate = true;
  result.platforms.push(roofPlat);
  platforms.push(roofPlat);

  // ── Awning (1 story up) for shop/cafe ─────────────────
  if (style === 'shop' || style === 'cafe') {
    const aw = w * 0.7;
    const awY = C.FLOOR_Y + storyH + 0.2;
    const awPlat = new Platform(x, awY, aw, 0.3);
    awPlat.mesh.material.map = awningTex(awningColor || '#cc5544', awningColor2 || '#f8f0e0');
    awPlat.mesh.material.needsUpdate = true;
    result.platforms.push(awPlat);
    platforms.push(awPlat);
    // decorative overhang in front of wall
    const decGeo = new THREE.PlaneGeometry(aw + 0.4, 0.35);
    const decMat = new THREE.MeshBasicMaterial({ map: awningTex(awningColor || '#cc5544', awningColor2 || '#f8f0e0') });
    const dec = new THREE.Mesh(decGeo, decMat);
    dec.position.set(x, awY + 0.05, 0.3);
    scene.add(dec);
  }

  // ── Window ledges every 2 stories ─────────────────────
  for (let s = 2; s < stories; s += 2) {
    const ledgeW = w * 0.55;
    const ledgeY = C.FLOOR_Y + s * storyH + 0.05;
    const lPlat = new Platform(x, ledgeY, ledgeW, 0.22);
    lPlat.mesh.material.map = ledgeTex('#ccc4b4');
    lPlat.mesh.material.needsUpdate = true;
    result.platforms.push(lPlat);
    platforms.push(lPlat);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
//  STREET DETAILS  (lamps, benches, plants)
// ─────────────────────────────────────────────────────────────
function addStreetDetails() {
  // 4 lamp posts across the town
  const lampXs = [6, 25, 48, 68];
  for (const lx of lampXs) {
    const pole = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 2.0),
      new THREE.MeshBasicMaterial({ map: solidTex('#5a5a5a', 8, 64) }),
    );
    pole.position.set(lx, C.FLOOR_Y + 1.1, 0.35);
    scene.add(pole);
    const head = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.22),
      new THREE.MeshBasicMaterial({ map: solidTex('#988878', 24, 8) }),
    );
    head.position.set(lx + 0.15, C.FLOOR_Y + 2.05, 0.36);
    scene.add(head);
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.4),
      new THREE.MeshBasicMaterial({ map: solidTex('#f8e8b8', 16, 8), transparent: true, opacity: 0.07 }),
    );
    glow.position.set(lx + 0.15, C.FLOOR_Y + 1.9, 0.34);
    scene.add(glow);
    twinkleLights.push(glow.material);
  }

  // 1 crosswalk
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.16),
      new THREE.MeshBasicMaterial({ map: solidTex('#e8e4dc', 16, 4), transparent: true, opacity: 0.35 }),
    );
    stripe.position.set(35 + i * 0.8, C.FLOOR_Y - 0.12, 0.33);
    scene.add(stripe);
  }

  // Potted plants / bushes
  const plantXs = [10, 32, 52, 72];
  for (const px of plantXs) {
    // pot
    const pot = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.4),
      new THREE.MeshBasicMaterial({ map: solidTex('#b08060', 16, 16) }),
    );
    pot.position.set(px, C.FLOOR_Y + 0.2, 0.4);
    scene.add(pot);
    // bush
    const bush = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.55),
      new THREE.MeshBasicMaterial({ map: solidTex('#6aaa55', 16, 16) }),
    );
    bush.position.set(px, C.FLOOR_Y + 0.6, 0.41);
    scene.add(bush);
  }

  // Bench
  const bench = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.6),
    new THREE.MeshBasicMaterial({ map: solidTex('#9a8070', 32, 16) }),
  );
  bench.position.set(40, C.FLOOR_Y + 0.3, 0.38);
  scene.add(bench);
}

// ─────────────────────────────────────────────────────────────
//  BUILDING HELPER  (generic decorative mesh)
// ─────────────────────────────────────────────────────────────
function addBuilding(x, y, w, h, color, zDepth = 0, map = null) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ map: map || solidTex(color, 32, 128) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, zDepth);
  scene.add(mesh);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────────────────────────
let platforms  = [];
let enemies    = [];
let chars      = [];
let parLayer1, parLayer2;
let twinkleLights = [];
let leaderIdx  = 0;
let camX       = 0;
let camY       = 0;
let gameState = 'start';

// ─────────────────────────────────────────────────────────────
//  CREATE LEVEL  –  Cozy Town Square (3 zones across ~80 units)
// ─────────────────────────────────────────────────────────────
function createLevel() {
  // ── Floor ─────────────────────────────────────────────
  platforms.push(new Platform(WORLD_W / 2, C.FLOOR_Y - 0.5, WORLD_W + 4, 1.4, '#a89e90'));

  // ── Street cobblestone strip ──────────────────────────
  const streetGeo = new THREE.PlaneGeometry(WORLD_W + 4, 1.3);
  const streetMat = new THREE.MeshBasicMaterial({ map: streetTex() });
  const street = new THREE.Mesh(streetGeo, streetMat);
  street.position.set(WORLD_W / 2, C.FLOOR_Y + 0.05, 0.25);
  scene.add(street);

  addStreetDetails();

  // ═══════════════════════════════════════════════════════
  //  ZONE 1: Residential approach  (x = 2 .. 18)
  // ═══════════════════════════════════════════════════════
  createBuilding({ x: 4,  w: 5, stories: 4, style: 'residential', seed: 10, roofColor: '#a86848' });
  createBuilding({ x: 12, w: 6, stories: 5, style: 'residential', seed: 11, roofColor: '#b07858', bodyColor: '#ccc0a8' });
  createBuilding({ x: 19, w: 4, stories: 3, style: 'residential', seed: 12, roofColor: '#987050' });

  // ═══════════════════════════════════════════════════════
  //  ZONE 2: Central town square  (x = 22 .. 55)
  // ═══════════════════════════════════════════════════════
  // Bakery/café (left side of square)
  createBuilding({ x: 24, w: 6, stories: 3, style: 'cafe', seed: 20, awningColor: '#d85040', awningColor2: '#faf0e4', roofColor: '#c06040' });

  // General store (right side of square)
  createBuilding({ x: 42, w: 7, stories: 4, style: 'shop', seed: 21, awningColor: '#3878a8', awningColor2: '#e8f0f4', roofColor: '#8a6844' });

  // Small market stall / fountain in the centre
  const stallPlat = new Platform(33, C.FLOOR_Y + 0.6, 3.5, 0.4, '#c8b898');
  platforms.push(stallPlat);
  // stall visual
  const stallGeo = new THREE.PlaneGeometry(3.5, 1.2);
  const stallMat = new THREE.MeshBasicMaterial({ map: solidTex('#d8c8a4', 64, 32) });
  const stallMesh = new THREE.Mesh(stallGeo, stallMat);
  stallMesh.position.set(33, C.FLOOR_Y + 0.6, -0.05);
  scene.add(stallMesh);
  // stall awning
  const stallAwn = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 0.35),
    new THREE.MeshBasicMaterial({ map: awningTex('#e8a030', '#faf4e0') }),
  );
  stallAwn.position.set(33, C.FLOOR_Y + 1.3, 0.3);
  scene.add(stallAwn);

  // Mid-height connector platform between bakery roof and store roof
  const bridgePlat = new Platform(33, C.FLOOR_Y + 3 * 1.6 + 1.2, 4, 0.3, '#c0b4a0');
  platforms.push(bridgePlat);

  // ═══════════════════════════════════════════════════════
  //  ZONE 3: Far end — tall building + park  (x = 56 .. 78)
  // ═══════════════════════════════════════════════════════
  createBuilding({ x: 58, w: 5, stories: 3, style: 'shop', seed: 30, awningColor: '#508848', awningColor2: '#e8f0e0', roofColor: '#887858' });

  // The "tower" — tallest building in the level (6 stories)
  createBuilding({ x: 68, w: 6, stories: 6, style: 'tall', seed: 31, roofColor: '#806040', bodyColor: '#c4b498' });

  // Park area — trees
  const treePositions = [61, 74, 77];
  for (const tx of treePositions) {
    const tMat = new THREE.SpriteMaterial({ map: treeTex(), transparent: true });
    const tSprite = new THREE.Sprite(tMat);
    tSprite.scale.set(2.2, 3.3, 1);
    tSprite.position.set(tx, C.FLOOR_Y + 1.6, -0.08);
    scene.add(tSprite);
  }

  // ── Enemies (7 total, some on ground, some on rooftops) ─
  const gy = C.FLOOR_Y + 0.75;
  enemies.push(new Enemy(8,  gy,  3, 16));          // zone 1 ground
  enemies.push(new Enemy(28, gy, 22, 38));           // zone 2 ground left
  enemies.push(new Enemy(45, gy, 39, 52));           // zone 2 ground right
  enemies.push(new Enemy(62, gy, 56, 70));           // zone 3 ground
  // Rooftop enemies
  const roofY1 = C.FLOOR_Y + 3 * 1.6 + 0.75;       // 3-story roof
  enemies.push(new Enemy(24, roofY1, 21, 27));       // café rooftop
  const roofY2 = C.FLOOR_Y + 4 * 1.6 + 0.75;       // 4-story roof
  enemies.push(new Enemy(42, roofY2, 38.5, 45.5));   // store rooftop
  const roofY3 = C.FLOOR_Y + 6 * 1.6 + 0.75;       // 6-story roof
  enemies.push(new Enemy(68, roofY3, 65, 71));       // tower rooftop
}

// ─────────────────────────────────────────────────────────────
//  PARALLAX  –  mountains + background houses
// ─────────────────────────────────────────────────────────────
function createParallax() {
  // ── Sky band ──────────────────────────────────────────
  const skyBand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W + 60, 20),
    new THREE.MeshBasicMaterial({ map: solidTex('#d7ebfb', 256, 64) }),
  );
  skyBand.position.set(WORLD_W / 2, C.FLOOR_Y + 14, -4.2);
  scene.add(skyBand);

  // ── Cloud strip ───────────────────────────────────────
  const cloudStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W + 60, 8),
    new THREE.MeshBasicMaterial({ map: cloudStripTex(), transparent: true, opacity: 0.45 }),
  );
  cloudStrip.position.set(WORLD_W / 2, C.FLOOR_Y + 11, -4.1);
  scene.add(cloudStrip);

  // ── Far mountains (Alpine silhouettes) ────────────────
  const mtnGroup = new THREE.Group();
  mtnGroup.position.z = -3.5;
  const mtnDefs = [
    { x: -5,  w: 18, h: 12, c: '#9db8d4', sc: '#e8f0f8' },
    { x: 15,  w: 22, h: 15, c: '#8dadc8', sc: '#e4ecf4' },
    { x: 38,  w: 16, h: 10, c: '#a0bcd6', sc: '#eaf2fa' },
    { x: 55,  w: 24, h: 16, c: '#90b0cc', sc: '#e6eef6' },
    { x: 78,  w: 20, h: 13, c: '#96b4d0', sc: '#e8f0f8' },
    { x: 95,  w: 15, h:  9, c: '#a4c0d8', sc: '#ecf4fa' },
  ];
  for (const m of mtnDefs) {
    const geo = new THREE.PlaneGeometry(m.w, m.h);
    const mat = new THREE.MeshBasicMaterial({ map: mountainTex(m.c, m.sc), transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(m.x, C.FLOOR_Y + m.h / 2 + 2, 0);
    mtnGroup.add(mesh);
  }
  scene.add(mtnGroup);
  parLayer1 = { group: mtnGroup };

  // ── Mid-distance background houses ────────────────────
  const houseGroup = new THREE.Group();
  houseGroup.position.z = -2.2;
  const housePalette = [
    { body: '#d2c0a8', roof: '#b08868', windowOn: '#f0e4d0', windowOff: '#c8d4de', cols: 2, rows: 3 },
    { body: '#c8b8a0', roof: '#a07858', windowOn: '#ece0cc', windowOff: '#c4d0da', cols: 3, rows: 3 },
    { body: '#dac8b0', roof: '#b89070', windowOn: '#f4e8d4', windowOff: '#ccd6e0', cols: 2, rows: 4 },
  ];
  let hx = -8;
  let hi = 0;
  while (hx < WORLD_W + 20) {
    const t = (hi * 37) % 97;
    const hw = 3.5 + (t % 40) / 40 * 3;
    const hh = 4 + (t % 30) / 30 * 3.5;
    const p = housePalette[hi % housePalette.length];
    const tex = buildingFacadeTex({ body: p.body, roof: p.roof, windowOn: p.windowOn, windowOff: p.windowOff, cols: p.cols, rows: p.rows, seed: 2000 + hi });
    const geo = new THREE.PlaneGeometry(hw, hh);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(hx + hw / 2, C.FLOOR_Y + hh / 2 - 0.3, 0);
    houseGroup.add(mesh);
    hx += hw * 1.15;
    hi++;
  }
  scene.add(houseGroup);
  parLayer2 = { group: houseGroup };

  // ── Gentle depth haze ─────────────────────────────────
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_W + 60, 22),
    new THREE.MeshBasicMaterial({ map: hazeTex(), transparent: true, opacity: 0.14 }),
  );
  haze.position.set(WORLD_W / 2, C.FLOOR_Y + 7.5, -2.9);
  scene.add(haze);
}

// ─────────────────────────────────────────────────────────────
//  SPAWN CHARACTERS
// ─────────────────────────────────────────────────────────────
function spawnChars() {
  chars = [];
  for (let i = 0; i < CHAR_DEF.length; i++) {
    chars.push(new Character(CHAR_DEF[i], 2 + i * 1.2));
  }
  leaderIdx = 0;
}

// ─────────────────────────────────────────────────────────────
//  COLLISION  –  resolve a character against all platforms
// ─────────────────────────────────────────────────────────────
function resolveCollision(ch) {
  ch.grounded = false;
  const cy = ch.pos.y;
  const cx = ch.pos.x;

  for (const plat of platforms) {
    // Quick broad-phase rejection
    if (Math.abs(cx - plat.x) > plat.hw + CHAR_HW + 0.2) continue;
    if (Math.abs(cy - plat.y) > plat.hh + CHAR_HH + 0.2) continue;

    const overlapX = plat.hw + CHAR_HW - Math.abs(cx - plat.x);
    const overlapY = plat.hh + CHAR_HH - Math.abs(cy - plat.y);

    if (overlapX <= 0 || overlapY <= 0) continue;

    // One-way platforms: only land on top when falling (or standing still)
    if (cy > plat.y && ch.vy <= 0) {
      ch.pos.y = plat.y + plat.hh + CHAR_HH;
      ch.vy = 0;
      ch.grounded = true;
    }
  }

  // World floor
  if (ch.pos.y < C.FLOOR_Y + CHAR_HH) {
    ch.pos.y = C.FLOOR_Y + CHAR_HH;
    ch.vy = 0;
    ch.grounded = true;
  }

  // World side walls
  ch.pos.x = Math.max(CHAR_HW, Math.min(WORLD_W - CHAR_HW, ch.pos.x));
}

// ─────────────────────────────────────────────────────────────
//  COMBAT  –  leader attacks nearby enemies
// ─────────────────────────────────────────────────────────────
function doAttack(ch) {
  SFX.attack();
  const dir = ch.facingRight ? 1 : -1;
  const hitX = ch.pos.x + dir * (C.ATTACK_RANGE / 2 + CHAR_HW);

  // Flash attack sprite briefly
  ch.atkSprite.material.opacity = 0.9;
  ch.atkSprite.position.set(hitX, ch.pos.y, 0.5);
  setTimeout(() => { ch.atkSprite.material.opacity = 0; }, 120);

  for (const en of enemies) {
    if (en.dead) continue;
    if (Math.abs(en.pos.x - hitX) < C.ATTACK_RANGE &&
        Math.abs(en.pos.y - ch.pos.y) < 1.2) {
      en.hp -= 1;
      SFX.hit();
      en.vx = (en.pos.x > ch.pos.x ? 1 : -1) * C.KNOCKBACK_VX;
      en.vy = C.KNOCKBACK_VY;
      en.knockbackTimer = 0.3;
      if (en.hp <= 0) {
        SFX.defeat();
        en.remove();
      }
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

// ─────────────────────────────────────────────────────────────
//  ENEMY DAMAGE  –  enemies hurt the leader on contact
// ─────────────────────────────────────────────────────────────
let leaderHurtCooldown = 0;

function checkEnemyContact(dt) {
  if (leaderHurtCooldown > 0) { leaderHurtCooldown -= dt; return; }
  const leader = chars[leaderIdx];
  for (const en of enemies) {
    if (en.dead) continue;
    if (Math.abs(en.pos.x - leader.pos.x) < 1.0 &&
        Math.abs(en.pos.y - leader.pos.y) < 1.0) {
      leader.hp = Math.max(0, leader.hp - 1);
      SFX.hit();
      leaderHurtCooldown = 1.2; // 1.2 s grace period
      leader.knockbackTimer = 0.25;
      leader.vx = (leader.pos.x > en.pos.x ? 1 : -1) * C.KNOCKBACK_VX;
      leader.vy = C.KNOCKBACK_VY;
      updateHeartsUI();
      if (leader.hp <= 0) triggerDeath();
      break;
    }
  }
}

function triggerDeath() {
  SFX.defeat();
  gameState = 'dead';
  modalTitle.textContent = 'GAME OVER';
  modalMsg.textContent   = 'Press any key to try again!';
  modalEl.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  HUD UPDATES
// ─────────────────────────────────────────────────────────────
function updateHeartsUI() {
  const leader = chars[leaderIdx];
  heartsEl.textContent = '❤️'.repeat(Math.max(0, leader.hp)) + '🖤'.repeat(Math.max(0, C.LEADER_MAX_HP - leader.hp));
}

function updateBadgeUI() {
  badgeEl.textContent = chars[leaderIdx].name;
}

// ─────────────────────────────────────────────────────────────
//  REINIT  –  full scene wipe & restart
// ─────────────────────────────────────────────────────────────
function clearScene() {
  while (scene.children.length > 0) scene.remove(scene.children[0]);
}

function initGame() {
  clearScene();
  scene.background = new THREE.Color(0xbfdcf4);
  platforms = [];
  enemies   = [];
  twinkleLights = [];
  leaderHurtCooldown = 0;
  createParallax();
  createLevel();
  spawnChars();
  camX = chars[leaderIdx].pos.x;
  camY = 0;
  updateHeartsUI();
  updateBadgeUI();
}

// ─────────────────────────────────────────────────────────────
//  UPDATE  –  main game loop tick
// ─────────────────────────────────────────────────────────────
function update(dt) {
  if (gameState !== 'play') return;
  dt = Math.min(dt, C.MAX_DT);

  const leader = chars[leaderIdx];

  // ── Leader switch (Tab) ────────────────────────────────
  if (consumeJust('Tab')) {
    leaderIdx = (leaderIdx + 1) % chars.length;
    SFX.menu();
    updateBadgeUI();
    updateHeartsUI();
  }

  // ── Mute toggle ───────────────────────────────────────
  if (consumeJust('KeyM')) {
    muted = !muted;
    muteBadge.textContent = muted ? '🔇' : '🔊';
  }

  // ── Pause ─────────────────────────────────────────────
  if (consumeJust('Escape')) {
    gameState = 'pause';
    modalTitle.textContent = '⏸ PAUSED';
    modalMsg.textContent   = 'Press Escape to continue';
    modalEl.classList.remove('hidden');
    return;
  }

  // ── Leader input ──────────────────────────────────────
  {
    const ch = chars[leaderIdx];
    const isKnockedBack = ch.knockbackTimer > 0;
    ch.knockbackTimer = Math.max(0, ch.knockbackTimer - dt);

    if (!isKnockedBack) {
      const movingLeft  = keys.has('KeyA') || keys.has('ArrowLeft');
      const movingRight = keys.has('KeyD') || keys.has('ArrowRight');

      if (movingRight) { ch.vx =  C.MOVE_SPD; ch.facingRight = true; }
      else if (movingLeft) { ch.vx = -C.MOVE_SPD; ch.facingRight = false; }
      else ch.vx = 0;

      if (ch.type === 'fly') {
        // Flying character: W/S / Up/Down for vertical, Space = extra thrust up
        const movingUp   = keys.has('KeyW') || keys.has('ArrowUp');
        const movingDown = keys.has('KeyS') || keys.has('ArrowDown');
        if (movingUp || keys.has('Space'))  ch.vy =  C.FLY_THRUST;
        else if (movingDown)                ch.vy = -C.FLY_THRUST;
        else ch.vy *= C.FLY_DAMP;
      } else {
        // Ground character: gravity + jump
        ch.vy += C.GRAVITY * dt;
        ch.vy  = Math.max(ch.vy, C.MAX_FALL);
        const wantsJump = keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp');
        if (wantsJump && ch.grounded) { ch.vy = C.JUMP_VY; SFX.jump(); }
      }
    } else {
      // Decay knockback horizontal component
      ch.vx *= 0.7;
      if (ch.type !== 'fly') {
        ch.vy += C.GRAVITY * dt;
        ch.vy = Math.max(ch.vy, C.MAX_FALL);
      }
    }

    // Attack
    ch.attackCooldown = Math.max(0, ch.attackCooldown - dt);
    if (consumeJust('KeyF') || consumeJust('Enter')) {
      if (ch.attackCooldown <= 0) {
        ch.attackCooldown = C.ATTACK_COOLDOWN;
        doAttack(ch);
      }
    }

    // Euler integration
    ch.pos.x += ch.vx * dt;
    ch.pos.y += ch.vy * dt;

    if (ch.type !== 'fly') resolveCollision(ch);
    else {
      // Flying: only side-wall and ceiling/floor clamp (no platform landing)
      ch.pos.x = Math.max(CHAR_HW, Math.min(WORLD_W - CHAR_HW, ch.pos.x));
      ch.pos.y = Math.max(C.FLOOR_Y + CHAR_HH, Math.min(WORLD_H / 2 - CHAR_HH, ch.pos.y));
    }
  }

  // ── Record history for leash ───────────────────────────
  chars[leaderIdx].recordHistory();

  // ── Followers (leash breadcrumb) ──────────────────────
  for (let i = 0; i < chars.length; i++) {
    if (i === leaderIdx) continue;
    const ch   = chars[i];
    // Each follower tracks the leader's N-frames-ago position
    // (simple broadcast leash: every follower lags behind the leader)
    const target = chars[leaderIdx].historyAt(C.LEASH_FRAMES);
    ch.pos.x += (target.x - ch.pos.x) * C.LEASH_LERP;
    ch.pos.y += (target.y - ch.pos.y) * C.LEASH_LERP;
    ch.recordHistory();

    // Gravity for non-fly followers so they land on platforms
    if (ch.type !== 'fly') {
      ch.vy += C.GRAVITY * dt;
      ch.vy  = Math.max(ch.vy, C.MAX_FALL);
      ch.pos.y += ch.vy * dt;
      resolveCollision(ch);
    }
  }

  // ── Enemies ────────────────────────────────────────────
  for (const en of enemies) {
    if (en.dead) continue;
    en.knockbackTimer = Math.max(0, en.knockbackTimer - dt);

    if (en.knockbackTimer <= 0) {
      // Normal patrol
      en.pos.x += en.vx * dt;
      if (en.pos.x > en.maxX) { en.pos.x = en.maxX; en.vx = -C.ENEMY_SPD; }
      if (en.pos.x < en.minX) { en.pos.x = en.minX; en.vx =  C.ENEMY_SPD; }
    } else {
      // Knockback still active
      en.pos.x += en.vx * dt;
      en.pos.y += en.vy * dt;
      en.vy += C.GRAVITY * dt;
    }

    // Keep enemy on floor (simple gravity snap)
    if (en.pos.y <= C.FLOOR_Y + 0.55) {
      en.pos.y = C.FLOOR_Y + 0.55;
      en.vy = 0;
    }

    // Sync eye sprite
    en.eyeSprite.position.set(en.pos.x, en.pos.y + 0.25, 1.1);
  }

  // ── Enemy contact damage ───────────────────────────────
  checkEnemyContact(dt);

  // ── Animations ────────────────────────────────────────
  const t = performance.now() / 1000;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch.type === 'fly') {
      // Wing flap: oscillate scale Y of the sprite
      const flap = 1 + 0.22 * Math.sin(t * 8 + i);
      ch.sprite.scale.y = (CHAR_HH * 2 + 0.4) * flap;
      // Gentle hover bob
      ch.sprite.position.y += 0.04 * Math.sin(t * 3 + i);
    } else {
      // Walk bob: tiny vertical squash/stretch when moving horizontally
      const moving = Math.abs(ch.vx) > 0.5;
      const bob = moving ? 1 + 0.08 * Math.sin(t * 12 + i) : 1;
      ch.sprite.scale.y = (CHAR_HH * 2 + 0.4) * bob;
    }
    // Face direction (flip sprite X)
    ch.sprite.scale.x = Math.abs(ch.sprite.scale.x) * (ch.facingRight ? 1 : -1);
  }

  // ── Camera follow ──────────────────────────────────────
  const leaderPosX = chars[leaderIdx].pos.x;
  const leaderPosY = chars[leaderIdx].pos.y;

  // Move camera only outside dead-zone
  if (Math.abs(leaderPosX - camX) > C.CAM_DEAD_X) {
    camX += (leaderPosX - camX) * C.CAM_LERP;
  }
  camY += (leaderPosY * 0.4 - camY) * C.CAM_LERP;

  // Clamp camera to world bounds
  const halfVW = C.SCREEN_W / 2;
  const halfVH = (C.SCREEN_W / (window.innerWidth / window.innerHeight)) / 2;
  camX = Math.max(halfVW, Math.min(WORLD_W - halfVW, camX));
  camY = Math.max(-C.SCREEN_H / 2 + halfVH, Math.min(C.SCREEN_H, camY));

  camera.position.x = camX;
  camera.position.y = camY;

  // Parallax is updated in updateParallax() after update() using prevCamX delta.
}

// ─────────────────────────────────────────────────────────────
//  PARALLAX  (needs previous frame camX, tracked separately)
// ─────────────────────────────────────────────────────────────
let prevCamX = 0;

function updateParallax() {
  const dx = camera.position.x - prevCamX;
  prevCamX = camera.position.x;
  // Layers move in OPPOSITE direction of camera  
  // (world is fixed; only bg layers appear to slide slower)
  if (parLayer1) parLayer1.group.position.x -= dx * (1 - C.PAR_FAR);
  if (parLayer2) parLayer2.group.position.x -= dx * (1 - C.PAR_MID);

  // Very subtle night twinkle so the city feels alive but quiet.
  const t = performance.now() / 1000;
  for (let i = 0; i < twinkleLights.length; i++) {
    const phase = i * 0.63;
    twinkleLights[i].opacity = 0.012 + 0.018 * (0.5 + 0.5 * Math.sin(t * 0.55 + phase));
  }
}

// ─────────────────────────────────────────────────────────────
//  GAME-STATE INPUT  (start / pause screens)
// ─────────────────────────────────────────────────────────────
function handleStateInput() {
  // Only consume justDown for non-play states so update() can still read F/Enter/Tab/Escape.
  if (gameState === 'start' && justDown.size > 0) {
    justDown.clear();
    ensureAudio();
    SFX.menu();
    modalEl.classList.add('hidden');
    gameState = 'play';
    return;
  }

  if (gameState === 'dead' && justDown.size > 0) {
    justDown.clear();
    SFX.menu();
    initGame();
    modalEl.classList.add('hidden');
    gameState = 'play';
    return;
  }

  if (gameState === 'pause' && justDown.has('Escape')) {
    justDown.delete('Escape');
    SFX.menu();
    modalEl.classList.add('hidden');
    gameState = 'play';
    return;
  }
}

// ─────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────
let lastTime = performance.now();

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt  = (now - lastTime) / 1000;
  lastTime  = now;

  handleStateInput();
  update(dt);
  updateParallax();
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────
initGame();
loop();

