// ============================================================
//  ANEZKA GAME  –  2.5D Isometric RPG  (Three.js + Vite)
//  Kind of made by a 9-year-old  🎮
// ============================================================
import './style.css';
import * as THREE from 'three';

// ─── Asset imports (placeholder PNGs – daughter will draw over these) ───
import aladdinUrl      from './assets/sprites/aladdin.png';
import abuUrl          from './assets/sprites/abu.png';
import jasmineUrl      from './assets/sprites/jasmine.png';
import carpetUrl       from './assets/sprites/carpet.png';
import enemyBasicUrl   from './assets/sprites/enemy-basic.png';
import bldResUrl       from './assets/sprites/building-residential.png';
import bldShopUrl      from './assets/sprites/building-shop.png';
import bldCafeUrl      from './assets/sprites/building-cafe.png';
import bldTowerUrl     from './assets/sprites/building-tower.png';
import treeUrl         from './assets/sprites/tree.png';
import bushUrl         from './assets/sprites/bush.png';
import lampUrl         from './assets/sprites/lamp.png';
import benchUrl        from './assets/sprites/bench.png';
import stallUrl        from './assets/sprites/market-stall.png';
import shadowUrl       from './assets/sprites/shadow.png';
import grassTexUrl     from './assets/textures/ground-grass.png';
import cobbleTexUrl    from './assets/textures/ground-cobble.png';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const C = {
  // World
  WORLD_SIZE: 80,           // XZ extent in world units

  // Camera
  CAM_FOV: 50,
  CAM_HEIGHT: 22,           // Y offset above target
  CAM_DIST: 22,             // Z offset behind target
  CAM_LERP: 0.08,           // smooth follow factor

  // Movement
  MOVE_SPD: 8,
  CARPET_HOVER: 0.6,        // extra Y for carpet
  CARPET_BOB_AMP: 0.15,
  CARPET_BOB_FREQ: 3,

  // Combat
  ATTACK_RANGE: 3.0,
  ATTACK_CONE: Math.PI / 2, // half-angle in radians (90° each side = 180° semicircle)
  ATTACK_COOLDOWN: 0.4,
  KNOCKBACK_SPD: 12,
  KNOCKBACK_DUR: 0.3,

  // Enemy
  ENEMY_SPD: 2.5,
  ENEMY_CONTACT_RANGE: 1.2,
  ENEMY_MAX_HP: 2,

  // Leader
  LEADER_MAX_HP: 10,
  HURT_COOLDOWN: 1.2,

  // Party leash
  LEASH_FRAMES: 12,
  LEASH_LERP: 0.22,

  // Sprite sizes (world units)
  CHAR_W: 1.2,
  CHAR_H: 1.8,
  CARPET_W: 1.6,
  CARPET_H: 1.0,
  ENEMY_W: 1.2,
  ENEMY_H: 1.2,

  // DT clamp
  MAX_DT: 0.033,
};

// ─────────────────────────────────────────────────────────────
//  DOM SETUP
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
    <div id="controls-hint">WASD = move | Tab = switch hero | F = attack | Esc = pause | M = mute</div>
  </div>
`;
const heartsEl   = document.getElementById('hearts');
const badgeEl    = document.getElementById('leader-badge');
const muteBadge  = document.getElementById('mute-badge');
const modalEl    = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMsg   = document.getElementById('modal-msg');

// ─────────────────────────────────────────────────────────────
//  RENDERER + SCENE + CAMERA
// ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.querySelector('#app').prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(
  C.CAM_FOV,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);
camera.position.set(C.WORLD_SIZE / 2, C.CAM_HEIGHT, C.WORLD_SIZE / 2 + C.CAM_DIST);
camera.lookAt(C.WORLD_SIZE / 2, 0, C.WORLD_SIZE / 2);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
dirLight.position.set(20, 30, 20);
scene.add(dirLight);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ─────────────────────────────────────────────────────────────
//  TEXTURE LOADER
// ─────────────────────────────────────────────────────────────
const loader = new THREE.TextureLoader();
const _texCache = {};

function loadTex(url, repeatX, repeatY, onLoaded) {
  const key = `${url}_${repeatX}_${repeatY}`;
  if (_texCache[key]) {
    // Already cached – fire callback immediately if image dimensions are available
    if (onLoaded) {
      const t = _texCache[key];
      if (t.image && t.image.width) onLoaded(t, t.image.width, t.image.height);
    }
    return _texCache[key];
  }
  const tex = loader.load(url, (t) => {
    if (onLoaded) onLoaded(t, t.image.width, t.image.height);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatX || repeatY) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
  }
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  _texCache[key] = tex;
  return tex;
}

// ─────────────────────────────────────────────────────────────
//  AUDIO  (simple Web Audio tones, no files)
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
  attack:  () => playTone(200, 'sawtooth', 0.09),
  hit:     () => playTone(120, 'square',   0.15),
  defeat:  () => { playTone(180, 'sawtooth', 0.3); setTimeout(() => playTone(100, 'sawtooth', 0.4), 150); },
  menu:    () => playTone(660, 'sine',     0.08),
};

// ─────────────────────────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────────────────────────
const keys = new Set();
const justDown = new Set();

window.addEventListener('keydown', e => {
  if (!keys.has(e.code)) justDown.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.code));

function consumeJust(code) {
  const had = justDown.has(code);
  justDown.delete(code);
  return had;
}

// ─────────────────────────────────────────────────────────────
//  SCREEN-RELATIVE MOVEMENT VECTORS
// ─────────────────────────────────────────────────────────────
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();

function updateCamDirections() {
  camera.getWorldDirection(_camFwd);
  _camFwd.y = 0;
  _camFwd.normalize();
  _camRight.crossVectors(_camFwd, new THREE.Vector3(0, 1, 0)).normalize().negate();
}

// ─────────────────────────────────────────────────────────────
//  COLLISION OBSTACLES  (circular keep-out zones)
// ─────────────────────────────────────────────────────────────
let obstacles = [];

function pushOutOfObstacles(wx, wz, entityRadius) {
  for (const obs of obstacles) {
    const dx = wx - obs.x;
    const dz = wz - obs.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = obs.radius + entityRadius;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      wx += (dx / dist) * push;
      wz += (dz / dist) * push;
    }
  }
  return { x: wx, z: wz };
}

function clampToWorld(wx, wz, entityRadius) {
  const lo = entityRadius;
  const hi = C.WORLD_SIZE - entityRadius;
  return {
    x: Math.max(lo, Math.min(hi, wx)),
    z: Math.max(lo, Math.min(hi, wz)),
  };
}

// ─────────────────────────────────────────────────────────────
//  SHADOW HELPER
// ─────────────────────────────────────────────────────────────
const shadowTex = loadTex(shadowUrl);

function createShadow() {
  const geo = new THREE.PlaneGeometry(1.4, 0.8);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  scene.add(mesh);
  return mesh;
}

// ─────────────────────────────────────────────────────────────
//  CHARACTER CLASS
// ─────────────────────────────────────────────────────────────
const CHAR_DEFS = [
  { name: 'ALADDIN', url: aladdinUrl, type: 'ground', w: C.CHAR_W, h: C.CHAR_H },
  { name: 'ABU',     url: abuUrl,     type: 'ground', w: C.CHAR_W * 0.75, h: C.CHAR_H * 0.7 },
  { name: 'JASMINE', url: jasmineUrl, type: 'ground', w: C.CHAR_W, h: C.CHAR_H },
  { name: 'CARPET',  url: carpetUrl,  type: 'fly',    w: C.CARPET_W, h: C.CARPET_H },
];

class Character {
  constructor(def, startX, startZ) {
    this.name = def.name;
    this.type = def.type;
    this.w = def.w;
    this.h = def.h;

    this.worldX = startX;
    this.worldZ = startZ;
    this.vx = 0;
    this.vz = 0;
    this.facingAngle = 0;
    this.hp = C.LEADER_MAX_HP;
    this.attackCooldown = 0;
    this.knockbackTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVz = 0;

    // Load texture; once the image is decoded, correct the sprite width
    // so the hand-drawn sprite keeps its natural aspect ratio.
    const tex = loadTex(def.url, null, null, (_t, imgW, imgH) => {
      this.w = def.h * (imgW / imgH);
      this.sprite.scale.set(this.w, def.h, 1);
    });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    // Start with a square placeholder – corrected by callback above
    this.sprite.scale.set(def.h, def.h, 1);
    this.sprite.position.set(startX, def.h / 2, startZ);
    scene.add(this.sprite);

    this.shadow = createShadow();

    const atkMat = new THREE.SpriteMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.atkSprite = new THREE.Sprite(atkMat);
    this.atkSprite.scale.set(C.ATTACK_RANGE * 0.8, 0.6, 1);
    scene.add(this.atkSprite);

    this.history = [];
    for (let i = 0; i < C.LEASH_FRAMES + 5; i++) {
      this.history.push({ x: startX, z: startZ });
    }
    this.histIdx = 0;
  }

  recordHistory() {
    this.history[this.histIdx] = { x: this.worldX, z: this.worldZ };
    this.histIdx = (this.histIdx + 1) % this.history.length;
  }

  historyAt(framesAgo) {
    const len = this.history.length;
    const idx = ((this.histIdx - framesAgo - 1) % len + len) % len;
    return this.history[idx];
  }

  syncSprite(time) {
    const hoverY = this.type === 'fly'
      ? C.CARPET_HOVER + C.CARPET_BOB_AMP * Math.sin(time * C.CARPET_BOB_FREQ)
      : 0;
    const speed = Math.sqrt(this.vx * this.vx + this.vz * this.vz);
    const walkBob = speed > 0.5 ? 0.06 * Math.sin(time * 12) : 0;

    this.sprite.position.set(this.worldX, this.h / 2 + hoverY + walkBob, this.worldZ);
    this.shadow.position.set(this.worldX, 0.02, this.worldZ);
  }

  remove() {
    scene.remove(this.sprite);
    scene.remove(this.shadow);
    scene.remove(this.atkSprite);
  }
}

// ─────────────────────────────────────────────────────────────
//  ENEMY CLASS
// ─────────────────────────────────────────────────────────────
class Enemy {
  constructor(x, z, patrolPoints) {
    this.worldX = x;
    this.worldZ = z;
    this.patrolPoints = patrolPoints;
    this.patrolIdx = 0;
    this.hp = C.ENEMY_MAX_HP;
    this.dead = false;
    this.knockbackTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVz = 0;
    this.flashTimer = 0;

    const tex = loadTex(enemyBasicUrl);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    this.sprite = new THREE.Sprite(mat);
    this.sprite.scale.set(C.ENEMY_W, C.ENEMY_H, 1);
    this.sprite.position.set(x, C.ENEMY_H / 2, z);
    scene.add(this.sprite);

    this.shadow = createShadow();
    this._origColor = new THREE.Color(1, 1, 1);
  }

  syncSprite(time) {
    const bob = 0.04 * Math.sin(time * 4 + this.worldX);
    this.sprite.position.set(this.worldX, C.ENEMY_H / 2 + bob, this.worldZ);
    this.shadow.position.set(this.worldX, 0.02, this.worldZ);

    if (this.flashTimer > 0) {
      this.sprite.material.color.setRGB(3, 1, 1);
    } else {
      this.sprite.material.color.copy(this._origColor);
    }
  }

  remove() {
    scene.remove(this.sprite);
    scene.remove(this.shadow);
    this.dead = true;
  }
}

// ─────────────────────────────────────────────────────────────
//  BUILDING HELPER
// ─────────────────────────────────────────────────────────────
function createBuilding(x, z, texUrl, worldW, worldH, collisionRadius) {
  const geo = new THREE.PlaneGeometry(worldW, worldH);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    alphaTest: 0.1,   // clip background fringe pixels from hand-drawn scans
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, worldH / 2, z);
  scene.add(mesh);

  // Load texture; auto-adjust mesh width to match image aspect ratio
  loadTex(texUrl, null, null, (tex, imgW, imgH) => {
    mat.map = tex;
    mat.needsUpdate = true;
    // Scale mesh X so the image fills worldH units tall at its natural ratio
    mesh.scale.x = (worldH * (imgW / imgH)) / worldW;
  });

  if (collisionRadius > 0) {
    obstacles.push({ x, z, radius: collisionRadius });
  }
  return mesh;
}

// ─────────────────────────────────────────────────────────────
//  PROP / TREE HELPER
// ─────────────────────────────────────────────────────────────
function createProp(x, z, texUrl, worldW, worldH, collisionRadius) {
  const tex = loadTex(texUrl);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(worldW, worldH, 1);
  spr.position.set(x, worldH / 2, z);
  scene.add(spr);

  if (collisionRadius > 0) {
    obstacles.push({ x, z, radius: collisionRadius });
  }
  return spr;
}

// ─────────────────────────────────────────────────────────────
//  GAME STATE
// ─────────────────────────────────────────────────────────────
let chars = [];
let enemies = [];
let leaderIdx = 0;
let gameState = 'start';
let leaderHurtCooldown = 0;

let camTargetX = C.WORLD_SIZE / 2;
let camTargetZ = C.WORLD_SIZE / 2;

// ─────────────────────────────────────────────────────────────
//  CREATE GROUND
// ─────────────────────────────────────────────────────────────
function createGround() {
  const grassTex = loadTex(grassTexUrl, C.WORLD_SIZE / 4, C.WORLD_SIZE / 4);
  const grassGeo = new THREE.PlaneGeometry(C.WORLD_SIZE, C.WORLD_SIZE);
  const grassMat = new THREE.MeshBasicMaterial({ map: grassTex, side: THREE.DoubleSide });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(C.WORLD_SIZE / 2, 0, C.WORLD_SIZE / 2);
  scene.add(grass);

  // Cobblestone paths crossing through center
  const cobbleTex = loadTex(cobbleTexUrl, 8, 1);
  const pathH = new THREE.Mesh(
    new THREE.PlaneGeometry(C.WORLD_SIZE * 0.7, 6),
    new THREE.MeshBasicMaterial({ map: cobbleTex, side: THREE.DoubleSide }),
  );
  pathH.rotation.x = -Math.PI / 2;
  pathH.position.set(C.WORLD_SIZE / 2, 0.01, C.WORLD_SIZE / 2);
  scene.add(pathH);

  const cobbleTex2 = loadTex(cobbleTexUrl, 1, 8);
  const pathV = new THREE.Mesh(
    new THREE.PlaneGeometry(6, C.WORLD_SIZE * 0.7),
    new THREE.MeshBasicMaterial({ map: cobbleTex2, side: THREE.DoubleSide }),
  );
  pathV.rotation.x = -Math.PI / 2;
  pathV.position.set(C.WORLD_SIZE / 2, 0.015, C.WORLD_SIZE / 2);
  scene.add(pathV);

  // Central plaza circle
  const plazaTex = loadTex(cobbleTexUrl, 4, 4);
  const plazaGeo = new THREE.CircleGeometry(8, 32);
  const plazaMat = new THREE.MeshBasicMaterial({ map: plazaTex, side: THREE.DoubleSide });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(C.WORLD_SIZE / 2, 0.02, C.WORLD_SIZE / 2);
  scene.add(plaza);
}

// ─────────────────────────────────────────────────────────────
//  CREATE LEVEL  –  Town Square
// ─────────────────────────────────────────────────────────────
function createLevel() {
  createGround();

  const cx = C.WORLD_SIZE / 2;
  const cz = C.WORLD_SIZE / 2;

  // ═══ BUILDINGS ═══
  // North side
  createBuilding(cx - 12, cz - 18, bldResUrl,   6, 12, 3.5);
  createBuilding(cx,      cz - 20, bldTowerUrl,  5, 15, 3.0);
  createBuilding(cx + 12, cz - 18, bldResUrl,   6, 12, 3.5);

  // South side
  createBuilding(cx - 10, cz + 18, bldCafeUrl,  6, 9, 3.5);
  createBuilding(cx + 6,  cz + 20, bldShopUrl,  6, 9, 3.5);
  createBuilding(cx + 16, cz + 17, bldResUrl,   5, 12, 3.0);

  // West side
  createBuilding(cx - 20, cz - 6,  bldShopUrl,  6, 9, 3.5);
  createBuilding(cx - 22, cz + 6,  bldCafeUrl,  6, 9, 3.5);

  // East side
  createBuilding(cx + 20, cz - 4,  bldResUrl,   5, 12, 3.0);
  createBuilding(cx + 22, cz + 8,  bldShopUrl,  6, 9, 3.5);

  // ═══ TREES ═══
  const treePositions = [
    [cx - 6, cz - 10], [cx + 8, cz - 12],
    [cx - 14, cz],      [cx + 14, cz + 2],
    [cx - 8, cz + 12], [cx + 10, cz + 10],
    [cx - 25, cz - 15], [cx + 25, cz - 15],
    [cx - 25, cz + 15], [cx + 25, cz + 15],
    [cx - 30, cz],      [cx + 30, cz],
    [15, 15], [65, 15], [15, 65], [65, 65],
    [10, 40], [70, 40], [40, 10], [40, 70],
  ];
  for (const [tx, tz] of treePositions) {
    createProp(tx, tz, treeUrl, 2.5, 3.8, 0.6);
  }

  // ═══ BUSHES ═══
  const bushPositions = [
    [cx - 4, cz - 6], [cx + 5, cz - 8],
    [cx - 3, cz + 7], [cx + 6, cz + 5],
    [cx - 16, cz - 12], [cx + 18, cz + 12],
  ];
  for (const [bx, bz] of bushPositions) {
    createProp(bx, bz, bushUrl, 1.2, 0.8, 0);
  }

  // ═══ LAMPS ═══
  const lampPositions = [
    [cx - 3, cz - 3], [cx + 3, cz - 3],
    [cx - 3, cz + 3], [cx + 3, cz + 3],
  ];
  for (const [lx, lz] of lampPositions) {
    createProp(lx, lz, lampUrl, 0.4, 2.4, 0);
  }

  // ═══ BENCHES ═══
  createProp(cx - 6, cz + 2, benchUrl, 1.6, 0.8, 0);
  createProp(cx + 7, cz - 2, benchUrl, 1.6, 0.8, 0);

  // ═══ MARKET STALL ═══
  createProp(cx, cz, stallUrl, 3, 2.5, 1.5);

  // ═══ ENEMIES ═══
  enemies.push(new Enemy(cx + 10, cz, [
    { x: cx + 10, z: cz - 5 }, { x: cx + 10, z: cz + 5 },
  ]));
  enemies.push(new Enemy(cx - 10, cz + 5, [
    { x: cx - 12, z: cz + 5 }, { x: cx - 6, z: cz + 5 },
  ]));
  enemies.push(new Enemy(cx, cz - 12, [
    { x: cx - 5, z: cz - 12 }, { x: cx + 5, z: cz - 12 },
  ]));
  enemies.push(new Enemy(cx + 5, cz + 14, [
    { x: cx + 2, z: cz + 14 }, { x: cx + 8, z: cz + 14 },
  ]));
  enemies.push(new Enemy(cx - 15, cz - 8, [
    { x: cx - 18, z: cz - 8 }, { x: cx - 12, z: cz - 3 },
  ]));
  enemies.push(new Enemy(cx + 16, cz + 12, [
    { x: cx + 14, z: cz + 10 }, { x: cx + 18, z: cz + 14 },
  ]));
  enemies.push(new Enemy(cx - 5, cz + 8, [
    { x: cx - 8, z: cz + 6 }, { x: cx - 2, z: cz + 10 },
  ]));
}

// ─────────────────────────────────────────────────────────────
//  BACKGROUND (distant scenery)
// ─────────────────────────────────────────────────────────────
function createBackground() {
  const mtnColor = new THREE.Color(0x8faec8);
  const mtnMat = new THREE.MeshBasicMaterial({ color: mtnColor, side: THREE.DoubleSide });

  for (let i = 0; i < 5; i++) {
    const w = 15 + Math.random() * 10;
    const h = 8 + Math.random() * 8;
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(geo, mtnMat.clone());
    m.position.set(10 + i * 16, h / 2, -10);
    scene.add(m);
  }

  for (let i = 0; i < 5; i++) {
    const w = 15 + Math.random() * 10;
    const h = 6 + Math.random() * 6;
    const geo = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(geo, mtnMat.clone());
    m.position.set(10 + i * 16, h / 2, C.WORLD_SIZE + 10);
    m.rotation.y = Math.PI;
    scene.add(m);
  }
}

// ─────────────────────────────────────────────────────────────
//  SPAWN CHARACTERS
// ─────────────────────────────────────────────────────────────
function spawnChars() {
  chars = [];
  const cx = C.WORLD_SIZE / 2;
  const cz = C.WORLD_SIZE / 2 + 8;
  for (let i = 0; i < CHAR_DEFS.length; i++) {
    chars.push(new Character(CHAR_DEFS[i], cx + i * 1.5, cz + i * 0.5));
  }
  leaderIdx = 0;
}

// ─────────────────────────────────────────────────────────────
//  COMBAT  –  40° cone attack
// ─────────────────────────────────────────────────────────────
function doAttack(ch) {
  SFX.attack();
  ch.attackCooldown = C.ATTACK_COOLDOWN;

  const fx = ch.worldX + Math.cos(ch.facingAngle) * C.ATTACK_RANGE * 0.5;
  const fz = ch.worldZ + Math.sin(ch.facingAngle) * C.ATTACK_RANGE * 0.5;
  ch.atkSprite.position.set(fx, ch.h / 2, fz);
  ch.atkSprite.material.opacity = 0.7;
  setTimeout(() => { ch.atkSprite.material.opacity = 0; }, 120);

  for (const en of enemies) {
    if (en.dead) continue;

    const dx = en.worldX - ch.worldX;
    const dz = en.worldZ - ch.worldZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > C.ATTACK_RANGE) continue;

    const angleToEnemy = Math.atan2(dz, dx);
    let angleDiff = angleToEnemy - ch.facingAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    if (Math.abs(angleDiff) > C.ATTACK_CONE) continue;

    en.hp -= 1;
    SFX.hit();
    en.flashTimer = 0.15;

    if (dist > 0.01) {
      en.knockbackVx = (dx / dist) * C.KNOCKBACK_SPD;
      en.knockbackVz = (dz / dist) * C.KNOCKBACK_SPD;
      en.knockbackTimer = C.KNOCKBACK_DUR;
    }

    if (en.hp <= 0) {
      SFX.defeat();
      en.remove();
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

// ─────────────────────────────────────────────────────────────
//  ENEMY CONTACT DAMAGE
// ─────────────────────────────────────────────────────────────
function checkEnemyContact(dt) {
  if (leaderHurtCooldown > 0) { leaderHurtCooldown -= dt; return; }
  const leader = chars[leaderIdx];

  for (const en of enemies) {
    if (en.dead) continue;
    const dx = en.worldX - leader.worldX;
    const dz = en.worldZ - leader.worldZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < C.ENEMY_CONTACT_RANGE) {
      leader.hp = Math.max(0, leader.hp - 1);
      SFX.hit();
      leaderHurtCooldown = C.HURT_COOLDOWN;

      if (dist > 0.01) {
        leader.knockbackVx = (-dx / dist) * C.KNOCKBACK_SPD;
        leader.knockbackVz = (-dz / dist) * C.KNOCKBACK_SPD;
        leader.knockbackTimer = C.KNOCKBACK_DUR;
      }

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
  modalMsg.textContent = 'Press any key to try again!';
  modalEl.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────────────────────
function updateHeartsUI() {
  const leader = chars[leaderIdx];
  heartsEl.textContent = '❤️'.repeat(Math.max(0, leader.hp)) + '🖤'.repeat(Math.max(0, C.LEADER_MAX_HP - leader.hp));
}

function updateBadgeUI() {
  badgeEl.textContent = chars[leaderIdx].name;
}

// ─────────────────────────────────────────────────────────────
//  SCENE RESET
// ─────────────────────────────────────────────────────────────
function clearScene() {
  while (scene.children.length > 0) {
    const child = scene.children[0];
    scene.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
      else child.material.dispose();
    }
  }
  scene.add(ambientLight);
  scene.add(dirLight);
}

function initGame() {
  clearScene();
  scene.background = new THREE.Color(0x87ceeb);
  obstacles = [];
  enemies = [];
  leaderHurtCooldown = 0;

  createBackground();
  createLevel();
  spawnChars();

  camTargetX = chars[leaderIdx].worldX;
  camTargetZ = chars[leaderIdx].worldZ;

  updateHeartsUI();
  updateBadgeUI();
}

// ─────────────────────────────────────────────────────────────
//  UPDATE
// ─────────────────────────────────────────────────────────────
function update(dt) {
  if (gameState !== 'play') return;
  dt = Math.min(dt, C.MAX_DT);

  const time = performance.now() / 1000;

  // ── Leader switch (Tab) ──
  if (consumeJust('Tab')) {
    leaderIdx = (leaderIdx + 1) % chars.length;
    SFX.menu();
    updateBadgeUI();
    updateHeartsUI();
  }

  // ── Mute toggle ──
  if (consumeJust('KeyM')) {
    muted = !muted;
    muteBadge.textContent = muted ? '🔇' : '🔊';
  }

  // ── Pause ──
  if (consumeJust('Escape')) {
    gameState = 'pause';
    modalTitle.textContent = '⏸ PAUSED';
    modalMsg.textContent = 'Press Escape to continue';
    modalEl.classList.remove('hidden');
    return;
  }

  // ── Camera direction vectors ──
  updateCamDirections();

  // ── Leader input ──
  {
    const ch = chars[leaderIdx];
    const isKB = ch.knockbackTimer > 0;
    ch.knockbackTimer = Math.max(0, ch.knockbackTimer - dt);

    if (!isKB) {
      let mx = 0, mz = 0;
      const up    = keys.has('KeyW') || keys.has('ArrowUp');
      const down  = keys.has('KeyS') || keys.has('ArrowDown');
      const left  = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');

      if (up)    { mx += _camFwd.x; mz += _camFwd.z; }
      if (down)  { mx -= _camFwd.x; mz -= _camFwd.z; }
      if (left)  { mx += _camRight.x; mz += _camRight.z; }
      if (right) { mx -= _camRight.x; mz -= _camRight.z; }

      const ml = Math.sqrt(mx * mx + mz * mz);
      if (ml > 0.01) {
        mx /= ml; mz /= ml;
        ch.vx = mx * C.MOVE_SPD;
        ch.vz = mz * C.MOVE_SPD;
        ch.facingAngle = Math.atan2(mz, mx);
      } else {
        ch.vx = 0;
        ch.vz = 0;
      }
    } else {
      ch.vx = ch.knockbackVx * (ch.knockbackTimer / C.KNOCKBACK_DUR);
      ch.vz = ch.knockbackVz * (ch.knockbackTimer / C.KNOCKBACK_DUR);
    }

    // Attack
    ch.attackCooldown = Math.max(0, ch.attackCooldown - dt);
    if (consumeJust('KeyF') || consumeJust('Enter')) {
      if (ch.attackCooldown <= 0) {
        doAttack(ch);
      }
    }

    ch.worldX += ch.vx * dt;
    ch.worldZ += ch.vz * dt;

    const pushed = pushOutOfObstacles(ch.worldX, ch.worldZ, 0.5);
    ch.worldX = pushed.x; ch.worldZ = pushed.z;
    const clamped = clampToWorld(ch.worldX, ch.worldZ, 0.5);
    ch.worldX = clamped.x; ch.worldZ = clamped.z;

    // Flip sprite based on screen-space direction
    if (Math.abs(ch.vx) > 0.1 || Math.abs(ch.vz) > 0.1) {
      const worldDir = new THREE.Vector3(ch.vx, 0, ch.vz);
      const screenDir = worldDir.project(camera);
      ch.sprite.scale.x = Math.abs(ch.sprite.scale.x) * (screenDir.x >= 0 ? 1 : -1);
    }
  }

  // ── Record history ──
  chars[leaderIdx].recordHistory();

  // ── Followers ──
  for (let i = 0; i < chars.length; i++) {
    if (i === leaderIdx) continue;
    const ch = chars[i];
    const target = chars[leaderIdx].historyAt(C.LEASH_FRAMES);

    ch.worldX += (target.x - ch.worldX) * C.LEASH_LERP;
    ch.worldZ += (target.z - ch.worldZ) * C.LEASH_LERP;

    const dx = target.x - ch.worldX;
    const dz = target.z - ch.worldZ;
    if (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05) {
      ch.facingAngle = Math.atan2(dz, dx);
    }

    const pushed = pushOutOfObstacles(ch.worldX, ch.worldZ, 0.4);
    ch.worldX = pushed.x; ch.worldZ = pushed.z;
    const clamped = clampToWorld(ch.worldX, ch.worldZ, 0.4);
    ch.worldX = clamped.x; ch.worldZ = clamped.z;

    ch.recordHistory();
    ch.syncSprite(time);
  }

  chars[leaderIdx].syncSprite(time);

  // ── Enemies ──
  for (const en of enemies) {
    if (en.dead) continue;

    en.knockbackTimer = Math.max(0, en.knockbackTimer - dt);
    en.flashTimer = Math.max(0, en.flashTimer - dt);

    if (en.knockbackTimer > 0) {
      const factor = en.knockbackTimer / C.KNOCKBACK_DUR;
      en.worldX += en.knockbackVx * factor * dt;
      en.worldZ += en.knockbackVz * factor * dt;
    } else {
      const wp = en.patrolPoints[en.patrolIdx];
      const dx = wp.x - en.worldX;
      const dz = wp.z - en.worldZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 0.5) {
        en.patrolIdx = (en.patrolIdx + 1) % en.patrolPoints.length;
      } else {
        en.worldX += (dx / dist) * C.ENEMY_SPD * dt;
        en.worldZ += (dz / dist) * C.ENEMY_SPD * dt;
      }
    }

    const pushed = pushOutOfObstacles(en.worldX, en.worldZ, 0.5);
    en.worldX = pushed.x; en.worldZ = pushed.z;
    const clamped = clampToWorld(en.worldX, en.worldZ, 0.5);
    en.worldX = clamped.x; en.worldZ = clamped.z;

    en.syncSprite(time);
  }

  // ── Enemy contact damage ──
  checkEnemyContact(dt);

  // ── Camera follow ──
  camTargetX += (chars[leaderIdx].worldX - camTargetX) * C.CAM_LERP;
  camTargetZ += (chars[leaderIdx].worldZ - camTargetZ) * C.CAM_LERP;

  const camMargin = 10;
  const clampedCamX = Math.max(camMargin, Math.min(C.WORLD_SIZE - camMargin, camTargetX));
  const clampedCamZ = Math.max(camMargin, Math.min(C.WORLD_SIZE - camMargin, camTargetZ));

  camera.position.set(clampedCamX, C.CAM_HEIGHT, clampedCamZ + C.CAM_DIST);
  camera.lookAt(clampedCamX, 0, clampedCamZ);
}

// ─────────────────────────────────────────────────────────────
//  STATE INPUT
// ─────────────────────────────────────────────────────────────
function handleStateInput() {
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
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  handleStateInput();
  update(dt);
  renderer.render(scene, camera);
}

// ─────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────
initGame();
loop();
