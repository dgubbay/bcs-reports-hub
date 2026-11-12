import * as THREE from './vendor/three.module.min.js';

const manifest = window.HUB_MANIFEST || { today: '', generatedAt: '', lands: [] };
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');
const shotLand = params.get('land') || 'sales';

const LAND_DEFS = [
  { id: 'castle', name: 'Command Center', short: 'Command', color: '#4c7cff', ink: 0x4c7cff, x: 0, z: 0, radius: 8, camera: [18, 16, 20], sign: 'BCS' },
  { id: 'finance', name: 'Finance HQ', short: 'Finance', color: '#d4a017', ink: 0xd4a017, x: 28, z: 18, radius: 8, camera: [14, 12, 16], sign: 'FINANCE' },
  { id: 'sales', name: 'Sales Center', short: 'Sales', color: '#e15a3a', ink: 0xe15a3a, x: 30, z: -12, radius: 8, camera: [15, 12, 12], sign: 'SALES' },
  { id: 'marketing', name: 'Marketing Studio', short: 'Marketing', color: '#8b5cf6', ink: 0x8b5cf6, x: 8, z: -30, radius: 8, camera: [14, 13, 12], sign: 'STUDIO' },
  { id: 'emails', name: 'Comms Building', short: 'Comms', color: '#22a06b', ink: 0x22a06b, x: -24, z: -18, radius: 8, camera: [-14, 11, 14], sign: 'COMMS' },
  { id: 'implementations', name: 'Implementations Lab', short: 'Lab', color: '#c26b3a', ink: 0xc26b3a, x: -28, z: 12, radius: 8, camera: [-14, 12, 14], sign: 'LAB' },
  { id: 'support', name: 'Support Center', short: 'Support', color: '#1f9bc7', ink: 0x1f9bc7, x: -8, z: 30, radius: 8, camera: [12, 13, 16], sign: 'SUPPORT' },
];

const ROOM_THEMES = {
  castle: { title: 'Command Center', subtitle: 'Operations lobby', floor: 0x2a3038, walls: 0xe8edf3, trim: 0x4c7cff, ceil: 0xf4f7fb, accent: 0x4c7cff, wood: 0x3a414c, light: 0xf2f6ff },
  finance: { title: 'Finance HQ', subtitle: 'Treasury conference room', floor: 0xc5bca8, walls: 0xf6f1e6, trim: 0xd4a017, ceil: 0xfbf8f1, accent: 0xd4a017, wood: 0x8a7048, light: 0xfff3d6 },
  sales: { title: 'Sales Center', subtitle: 'Briefing gallery', floor: 0x3e4148, walls: 0xf3ece6, trim: 0xe15a3a, ceil: 0xfaf7f4, accent: 0xe15a3a, wood: 0x6a3f32, light: 0xffe8df },
  marketing: { title: 'Marketing Studio', subtitle: 'Creative gallery', floor: 0x2d2a36, walls: 0xf0e9fb, trim: 0x8b5cf6, ceil: 0xfaf7ff, accent: 0x8b5cf6, wood: 0x4a3a62, light: 0xf0e6ff },
  emails: { title: 'Comms Building', subtitle: 'Library & mail room', floor: 0x6b5840, walls: 0xf3efe4, trim: 0x22a06b, ceil: 0xf7f4ea, accent: 0x22a06b, wood: 0x6b4f32, light: 0xe7f8ee },
  implementations: { title: 'Implementations Lab', subtitle: 'Workshop studio', floor: 0x4a4744, walls: 0xe9e4dc, trim: 0xc26b3a, ceil: 0xf2efe8, accent: 0xc26b3a, wood: 0x5a4030, light: 0xffe6d2 },
  support: { title: 'Support Center', subtitle: 'Help desk atrium', floor: 0xd9e3ea, walls: 0xeef6fb, trim: 0x1f9bc7, ceil: 0xf5fbff, accent: 0x1f9bc7, wood: 0x3d5a68, light: 0xdef4ff },
};

const landById = Object.fromEntries(LAND_DEFS.map((l) => [l.id, l]));
const reportsByLand = new Map(LAND_DEFS.map((l) => [l.id, []]));
for (const land of manifest.lands || []) {
  const list = reportsByLand.get(land.id) || [];
  list.push(...(land.reports || []));
  reportsByLand.set(land.id, list);
}
for (const [id, list] of reportsByLand) {
  list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.title || '').localeCompare(a.title || ''));
  reportsByLand.set(id, list);
}

function countFor(id) { return (reportsByLand.get(id) || []).length; }
function newCountFor(id) { return (reportsByLand.get(id) || []).filter((r) => r.isNew).length; }

const isMobile = !shotMode && (matchMedia('(max-width: 720px), (pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 1);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const use2DRoom = isMobile || (!shotMode && typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2);

const els = {
  canvas: document.getElementById('world'),
  loader: document.getElementById('loader'),
  tooltip: document.getElementById('tooltip'),
  legendList: document.getElementById('legend-list'),
  minimap: document.getElementById('minimap'),
  search: document.getElementById('search'),
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  listView: document.getElementById('list-view'),
  listBody: document.getElementById('list-body'),
  today: document.getElementById('today-label'),
  btnSearch: document.getElementById('btn-search'),
  btnList: document.getElementById('btn-list'),
  btnHelp: document.getElementById('btn-help'),
  fade: document.getElementById('fade'),
  roomHud: document.getElementById('room-hud'),
  roomName: document.getElementById('room-name'),
  roomSub: document.getElementById('room-sub'),
  btnExit: document.getElementById('btn-exit'),
  wallNav: document.getElementById('wall-nav'),
  wallIndicator: document.getElementById('wall-indicator'),
  btnWallPrev: document.getElementById('btn-wall-prev'),
  btnWallNext: document.getElementById('btn-wall-next'),
  room2d: document.getElementById('room-2d'),
  room2dGrid: document.getElementById('room-2d-grid'),
  hints: document.getElementById('hints'),
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

if (els.today) {
  const n = (manifest.lands || []).reduce((a, l) => a + (l.reports || []).length, 0);
  els.today.textContent = manifest.today
    ? `${fmtDate(manifest.today)} · ${n} report${n === 1 ? '' : 's'} on campus`
    : 'Campus reports map';
}

function reportButton(r) {
  const a = document.createElement('a');
  a.className = 'report';
  a.href = r.href;
  a.target = '_blank';
  a.rel = 'noopener';
  a.innerHTML = `<div class="title"></div><div class="meta"></div>`;
  a.querySelector('.title').textContent = r.title;
  const meta = a.querySelector('.meta');
  const date = document.createElement('span');
  date.className = 'chip';
  date.textContent = fmtDate(r.date) || r.date || '';
  meta.appendChild(date);
  if (r.bot) {
    const bot = document.createElement('span');
    bot.className = 'chip';
    bot.textContent = r.bot;
    meta.appendChild(bot);
  }
  if (r.isNew) {
    const badge = document.createElement('span');
    badge.className = 'chip today';
    badge.textContent = 'New today';
    meta.appendChild(badge);
  }
  return a;
}

function allReports() {
  const out = [];
  for (const def of LAND_DEFS) {
    for (const r of reportsByLand.get(def.id) || []) out.push({ ...r, landId: def.id, landName: def.name });
  }
  return out;
}

function renderSearch(q) {
  const query = (q || '').trim().toLowerCase();
  const rows = allReports().filter((r) => !query || [r.title, r.bot, r.landName, r.date].join(' ').toLowerCase().includes(query));
  els.searchResults.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No matching reports.';
    els.searchResults.appendChild(empty);
    return;
  }
  for (const r of rows.slice(0, 40)) els.searchResults.appendChild(reportButton(r));
}

function renderList() {
  els.listBody.innerHTML = '';
  for (const def of LAND_DEFS) {
    const reports = reportsByLand.get(def.id) || [];
    const h = document.createElement('h2');
    h.textContent = `${def.name} (${reports.length})`;
    els.listBody.appendChild(h);
    if (!reports.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No reports yet.';
      els.listBody.appendChild(empty);
    } else {
      for (const r of reports) els.listBody.appendChild(reportButton(r));
    }
  }
}

function buildLegend() {
  els.legendList.innerHTML = '';
  for (const def of LAND_DEFS) {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.dataset.land = def.id;
    const fresh = newCountFor(def.id) > 0;
    li.innerHTML = `<i class="${fresh ? 'glow-dot' : ''}"></i><span></span><span class="count"></span>`;
    li.querySelector('i').style.background = def.color;
    li.querySelector('span').textContent = def.short;
    li.querySelector('.count').textContent = String(countFor(def.id));
    const go = () => enterLand(def.id);
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    els.legendList.appendChild(li);
  }
}

function landAccent(id) {
  return (landById[id] && landById[id].color) || '#4c7cff';
}

function fillRoom2D(id) {
  const def = landById[id];
  const theme = ROOM_THEMES[id] || ROOM_THEMES.castle;
  const reports = reportsByLand.get(id) || [];
  els.room2dGrid.innerHTML = '';
  els.room2d.style.background = `radial-gradient(ellipse at 50% 0%, ${landAccent(id)}33, #0b1522 62%)`;
  if (!reports.length) {
    const plaque = document.createElement('div');
    plaque.className = 'plaque';
    plaque.innerHTML = `<h3>No reports yet</h3><p>This room is ready for the next dispatch.</p>`;
    els.room2dGrid.appendChild(plaque);
    return;
  }
  for (const r of reports) {
    const a = document.createElement('a');
    a.className = 'tile-card';
    a.href = r.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = `<div class="band"></div>${r.isNew ? '<div class="ribbon">New today</div>' : ''}<h3></h3><div class="meta"></div>`;
    a.querySelector('.band').style.background = def.color;
    a.querySelector('h3').textContent = r.title;
    const meta = a.querySelector('.meta');
    const date = document.createElement('span');
    date.className = 'chip';
    date.textContent = fmtDate(r.date) || r.date || '';
    meta.appendChild(date);
    if (r.bot) {
      const bot = document.createElement('span');
      bot.className = 'chip';
      bot.textContent = r.bot;
      meta.appendChild(bot);
    }
    els.room2dGrid.appendChild(a);
  }
}

let listOpen = false;
function setListOpen(open) {
  listOpen = open;
  els.listView.classList.toggle('open', open);
  els.btnList.textContent = open ? 'Map view' : 'List view';
  if (open) renderList();
}
function setSearchOpen(open) {
  els.search.classList.toggle('open', open);
  if (open) {
    renderSearch(els.searchInput.value);
    setTimeout(() => els.searchInput.focus(), 20);
  }
}

els.btnSearch.addEventListener('click', () => setSearchOpen(true));
els.btnList.addEventListener('click', () => setListOpen(!listOpen));
els.btnHelp.addEventListener('click', () => {
  alert('Explore the campus:\n\n• Drag to orbit, right-drag or two-finger drag to pan, scroll or pinch to zoom\n• WASD or arrow keys move around the grounds\n• Hover a building for its name and report count\n• Click a building to go inside and view reports as large wall screens\n• In a room, drag to look around and use the wall arrows to change walls\n• Search (or press /) jumps to any report\n• List view is a plain, accessible catalog');
});
els.search.addEventListener('click', (e) => { if (e.target === els.search) setSearchOpen(false); });
els.searchInput.addEventListener('input', () => renderSearch(els.searchInput.value));
els.btnExit.addEventListener('click', () => leaveLand());
els.btnWallPrev.addEventListener('click', () => cycleWall(-1));
els.btnWallNext.addEventListener('click', () => cycleWall(1));
window.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(e.target.tagName);
  if (e.key === 'Escape') {
    setSearchOpen(false);
    if (inRoom) leaveLand();
    if (listOpen) setListOpen(false);
  } else if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && !typing) {
    e.preventDefault();
    setSearchOpen(true);
  } else if (inRoom && !typing && !use2DRoom) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); cycleWall(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); cycleWall(1); }
  }
});

buildLegend();
renderList();

// ---------------------------------------------------------------------------
// 3D campus
// ---------------------------------------------------------------------------
let renderer, scene, camera, clock, sun, hemi;
let campusRoot, roomRoot, waterPond, fountainJets, clouds, drones, birds;
const landGroups = new Map();
const landBeacons = new Map();
const hitTargets = [];
const flags = [];
const labels = [];
const walkers = [];
let hovered = null;
let enteredId = null;
let inRoom = false;
let entering = false;
let roomTiles = [];
let roomDoor = null;
let roomWalls = [];
let roomWallIndex = 0;
let hoveredTile = null;
let roomLookYaw = 0;
let roomLookPitch = 0;
let roomLookTargetYaw = 0;
let roomLookTargetPitch = 0;

const mapHints = 'Drag to orbit · Scroll to zoom · WASD or arrows to move · Click a building to step inside';
const roomHints = 'Drag to look around · Use the wall arrows · Exit to map';

const cameraRig = {
  target: new THREE.Vector3(0, 2, 0),
  spherical: new THREE.Spherical(70, 1.02, 0.62),
  minR: 16, maxR: 130, minPhi: 0.28, maxPhi: 1.32,
  flying: false,
  flyFromPos: new THREE.Vector3(), flyFromTarget: new THREE.Vector3(),
  flyToPos: new THREE.Vector3(), flyToTarget: new THREE.Vector3(),
  flyT: 0, flyDur: 1.15, onDone: null,
};

const overview = { pos: new THREE.Vector3(46, 38, 56), target: new THREE.Vector3(0, 3, 0) };
const ROOM_ORIGIN = new THREE.Vector3(0, 240, 0);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.04,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flat ?? false,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

function addMesh(parent, geom, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geom, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = !isMobile;
  m.receiveShadow = !isMobile;
  parent.add(m);
  return m;
}

function signLabel(def) {
  const labels = {
    castle: 'COMMAND\nCENTER',
    finance: 'FINANCE HQ',
    sales: 'SALES\nCENTER',
    marketing: 'MARKETING\nSTUDIO',
    emails: 'COMMS\nBUILDING',
    implementations: 'IMPLEMENTATIONS\nLAB',
    support: 'SUPPORT\nCENTER',
  };
  return labels[def.id] || String(def.name || def.sign || '').toUpperCase();
}

function makeSignTexture(text, bg, fg = '#ffffff') {
  let lines = String(text).replace(/\\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].length > 14 && lines[0].includes(' ')) {
    const parts = lines[0].split(/\s+/);
    const mid = Math.ceil(parts.length / 2);
    lines = [parts.slice(0, mid).join(' '), parts.slice(mid).join(' ')];
  }
  if (!lines.length) lines = [''];

  const c = document.createElement('canvas');
  const W = 2048, H = 512;
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  g.fillStyle = '#07090c';
  g.fillRect(0, 0, W, H);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, 32);
  g.fillRect(0, H - 32, W, 32);
  g.strokeStyle = bg;
  g.lineWidth = 18;
  g.strokeRect(22, 22, W - 44, H - 44);
  g.strokeStyle = 'rgba(255,255,255,0.88)';
  g.lineWidth = 5;
  g.strokeRect(40, 40, W - 80, H - 80);

  const maxW = W - 160;
  const lineCount = lines.length;
  let size = lineCount === 1 ? 240 : 168;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const fontFor = (px) => `800 ${px}px Outfit, "Segoe UI", Arial, sans-serif`;
  g.font = fontFor(size);
  while (size > 72 && lines.some((ln) => g.measureText(ln).width > maxW)) {
    size -= 4;
    g.font = fontFor(size);
  }
  const gap = size * 0.16;
  const block = lineCount * size + (lineCount - 1) * gap;
  let y = (H - block) / 2 + size / 2;
  for (const ln of lines) {
    g.lineJoin = 'round';
    g.miterLimit = 2;
    g.lineWidth = Math.max(12, size * 0.07);
    g.strokeStyle = 'rgba(0,0,0,0.9)';
    g.strokeText(ln, W / 2, y);
    g.fillStyle = fg;
    g.fillText(ln, W / 2, y);
    y += size + gap;
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function signFaceMaterial(tex) {
  return new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.32,
    metalness: 0.06,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.75,
  });
}

function rooftopSign(parent, text, color, y, w = 14) {
  const tex = makeSignTexture(text, color, '#ffffff');
  const h = Math.max(2.55, w * 0.22);
  const group = new THREE.Group();
  group.name = `Sign: ${String(text).replace(/\n/g, ' ')}`;
  group.userData.isSign = true;
  group.userData.signText = String(text).replace(/\n/g, ' ');
  group.position.y = y;
  parent.add(group);

  const frameMat = mat(0x111418, { roughness: 0.3, metalness: 0.38 });
  const faceMat = signFaceMaterial(tex);
  const lightMat = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2 });

  const addBoard = (ry) => {
    const board = new THREE.Group();
    board.rotation.y = ry;
    addMesh(board, new THREE.BoxGeometry(w + 0.36, h + 0.36, 0.26), frameMat, 0, 0, 0);
    const face = addMesh(board, new THREE.PlaneGeometry(w, h), faceMat, 0, 0, 0.15);
    face.castShadow = false;
    const face2 = addMesh(board, new THREE.PlaneGeometry(w, h), faceMat, 0, 0, -0.15, 0, Math.PI, 0);
    face2.castShadow = false;
    addMesh(board, new THREE.BoxGeometry(w + 0.4, 0.12, 0.38), lightMat, 0, h / 2 + 0.2, 0).castShadow = false;
    group.add(board);
  };
  addBoard(0);
  addBoard(Math.PI / 2);

  const postH = 2.8;
  const postMat = mat(0x1c222a, { roughness: 0.4, metalness: 0.3 });
  const postSpan = Math.min(w * 0.36, 5.4);
  addMesh(group, new THREE.BoxGeometry(0.2, postH, 0.2), postMat, -postSpan, -h / 2 - postH / 2, 0);
  addMesh(group, new THREE.BoxGeometry(0.2, postH, 0.2), postMat, postSpan, -h / 2 - postH / 2, 0);
  return group;
}

function facadeSign(parent, text, color, y, z, w = 7.2) {
  const tex = makeSignTexture(text, color, '#ffffff');
  const h = Math.max(1.45, w * 0.24);
  const group = new THREE.Group();
  group.name = `Facade sign: ${String(text).replace(/\n/g, ' ')}`;
  group.userData.isSign = true;
  group.userData.signText = String(text).replace(/\n/g, ' ');
  group.position.set(0, y, z);
  parent.add(group);
  addMesh(group, new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.18), mat(0x111418, { roughness: 0.3, metalness: 0.35 }), 0, 0, 0);
  const face = addMesh(group, new THREE.PlaneGeometry(w, h), signFaceMaterial(tex), 0, 0, 0.11);
  face.castShadow = false;
  return group;
}

function windowBands(group, w, h, d, y0, stories, frameMat, glassMat) {
  const inset = 0.08;
  for (let s = 0; s < stories; s++) {
    const y = y0 + s * 1.35 + 0.55;
    addMesh(group, new THREE.BoxGeometry(w - 0.25, 0.95, 0.04), glassMat, 0, y, d / 2 + inset);
    addMesh(group, new THREE.BoxGeometry(w - 0.25, 0.95, 0.04), glassMat, 0, y, -d / 2 - inset);
    addMesh(group, new THREE.BoxGeometry(0.04, 0.95, d - 0.25), glassMat, w / 2 + inset, y, 0);
    addMesh(group, new THREE.BoxGeometry(0.04, 0.95, d - 0.25), glassMat, -w / 2 - inset, y, 0);
    if (s > 0) addMesh(group, new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04), frameMat, 0, y0 + s * 1.35, 0);
  }
}

function entrance(group, w, zFace, accent) {
  addMesh(group, new THREE.BoxGeometry(3.2, 2.4, 0.2), mat(0x1a1e24, { roughness: 0.4 }), 0, 1.2, zFace + 0.15);
  addMesh(group, new THREE.BoxGeometry(4.2, 0.14, 1.8), mat(accent, { roughness: 0.35, metalness: 0.25 }), 0, 2.55, zFace + 0.7);
  addMesh(group, new THREE.BoxGeometry(0.16, 2.5, 0.16), mat(0x2a3038), -2.0, 1.25, zFace + 1.4);
  addMesh(group, new THREE.BoxGeometry(0.16, 2.5, 0.16), mat(0x2a3038), 2.0, 1.25, zFace + 1.4);
}

function hvac(group, y, z = 0) {
  addMesh(group, new THREE.BoxGeometry(1.4, 0.7, 1.1), mat(0x7a818a, { metalness: 0.3, roughness: 0.4 }), -1.4, y, z);
  addMesh(group, new THREE.BoxGeometry(1.1, 0.55, 0.9), mat(0x6a717a, { metalness: 0.3, roughness: 0.4 }), 1.2, y - 0.05, z - 0.4);
}

function officeBuilding(group, def, opts) {
  const { w, d, stories, accent, body = 0xf2f4f7, frame = 0x2c333c } = opts;
  const storyH = 1.35;
  const h = stories * storyH;
  const bodyMat = mat(body, { roughness: 0.5 });
  const frameMat = mat(frame, { roughness: 0.38, metalness: 0.2 });
  const glassMat = mat(0x7eafd2, { roughness: 0.12, metalness: 0.35, opacity: 0.62 });
  const accentMat = mat(accent, { roughness: 0.4, metalness: 0.18 });
  addMesh(group, new THREE.BoxGeometry(w + 1.2, 0.28, d + 1.2), mat(0xd5d2cb, { roughness: 0.85 }), 0, 0.14, 0);
  addMesh(group, new THREE.BoxGeometry(w, h, d), bodyMat, 0, h / 2 + 0.28, 0);
  windowBands(group, w, h, d, 0.28, stories, frameMat, glassMat);
  addMesh(group, new THREE.BoxGeometry(w + 0.3, 0.28, d + 0.3), frameMat, 0, h + 0.4, 0);
  addMesh(group, new THREE.BoxGeometry(0.22, h + 0.2, 0.22), accentMat, -w / 2, h / 2 + 0.28, d / 2);
  addMesh(group, new THREE.BoxGeometry(0.22, h + 0.2, 0.22), accentMat, w / 2, h / 2 + 0.28, d / 2);
  entrance(group, w, d / 2, accent);
  hvac(group, h + 0.85, -d * 0.28);
  const colorCss = '#' + new THREE.Color(accent).getHexString();
  const label = signLabel(def);
  rooftopSign(group, label, colorCss, h + 6.4, Math.max(w * 1.6, 14));
  facadeSign(group, label, colorCss, 3.35, d / 2 + 0.22, Math.min(w * 0.95, 9.2));
}

function buildCommand(group, def) {
  const glass = mat(0x6ea4cc, { roughness: 0.1, metalness: 0.4, opacity: 0.7 });
  const frame = mat(0x1b2230, { roughness: 0.35, metalness: 0.25 });
  const white = mat(0xf4f6f9, { roughness: 0.5 });
  const accent = mat(0x4c7cff, { roughness: 0.32, metalness: 0.2, emissive: 0x1a3a8a, emissiveIntensity: 0.15 });
  addMesh(group, new THREE.BoxGeometry(11, 0.4, 11), mat(0xd8d5ce, { roughness: 0.85 }), 0, 0.2, 0);
  addMesh(group, new THREE.BoxGeometry(9.4, 4.2, 9.4), white, 0, 2.4, 0);
  windowBands(group, 9.4, 4.2, 9.4, 0.35, 3, frame, glass);
  addMesh(group, new THREE.BoxGeometry(6.4, 10.5, 6.4), white, 0, 9.7, 0);
  windowBands(group, 6.4, 10.5, 6.4, 4.5, 7, frame, glass);
  addMesh(group, new THREE.BoxGeometry(4.2, 4.6, 4.2), frame, 0, 17.2, 0);
  windowBands(group, 4.2, 4.6, 4.2, 15.0, 3, frame, glass);
  addMesh(group, new THREE.BoxGeometry(4.6, 0.3, 4.6), accent, 0, 19.6, 0);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 3.2, 8), frame, 0, 21.3, 0);
  addMesh(group, new THREE.SphereGeometry(0.22, 10, 10), mat(0x4c7cff, { emissive: 0x4c7cff, emissiveIntensity: 0.8 }), 0, 22.9, 0);
  entrance(group, 9.4, 4.7, 0x4c7cff);
  rooftopSign(group, 'COMMAND\nCENTER', '#4c7cff', 13.7, 16.5);
  facadeSign(group, 'COMMAND\nCENTER', '#4c7cff', 3.45, 4.92, 8.8);
  // plaza flag
  const pole = addMesh(group, new THREE.CylinderGeometry(0.06, 0.06, 5.5, 8), mat(0x9aa0a8, { metalness: 0.4 }), 5.6, 3.0, 5.6);
  const flag = addMesh(group, new THREE.PlaneGeometry(1.6, 0.9), mat(0x4c7cff, { side: THREE.DoubleSide }), 6.4, 5.3, 5.6);
  flag.userData.baseX = 6.4;
  flags.push(flag);
}

function buildFinance(group, def) {
  officeBuilding(group, def, { w: 9.2, d: 7.4, stories: 5, accent: 0xd4a017, body: 0xf3efe6 });
  addMesh(group, new THREE.CylinderGeometry(1.1, 1.1, 0.4, 20), mat(0xd4a017, { metalness: 0.55, roughness: 0.3 }), -4.6, 0.55, 4.6);
}

function buildSales(group, def) {
  officeBuilding(group, def, { w: 10.2, d: 7.0, stories: 4, accent: 0xe15a3a, body: 0xf7f3ef });
  // angled wing
  const wing = addMesh(group, new THREE.BoxGeometry(4.2, 3.6, 4.0), mat(0xf7f3ef), 5.4, 2.2, -1.2);
  wing.rotation.y = 0.35;
}

function buildMarketing(group, def) {
  officeBuilding(group, def, { w: 8.4, d: 8.0, stories: 3, accent: 0x8b5cf6, body: 0xf5f2fb });
  addMesh(group, new THREE.BoxGeometry(5.5, 2.8, 3.2), mat(0x8b5cf6, { roughness: 0.4 }), 0, 6.9, 2.6);
  const panel = addMesh(group, new THREE.BoxGeometry(5.1, 2.3, 0.08), mat(0xc4b0ff, { roughness: 0.2, metalness: 0.2, emissive: 0x6a40d0, emissiveIntensity: 0.12 }), 0, 6.9, 4.25);
}

function buildEmails(group, def) {
  officeBuilding(group, def, { w: 8.0, d: 7.2, stories: 4, accent: 0x22a06b, body: 0xf2f7f3 });
  addMesh(group, new THREE.CylinderGeometry(0.7, 0.85, 0.4, 12), mat(0x8a93a0, { metalness: 0.45 }), 3.6, 6.7, -1.4);
  addMesh(group, new THREE.SphereGeometry(1.05, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc5cdd4, { metalness: 0.35, roughness: 0.3, side: THREE.DoubleSide }), 3.6, 6.9, -1.4);
}

function buildImplementations(group, def) {
  officeBuilding(group, def, { w: 10.0, d: 7.6, stories: 3, accent: 0xc26b3a, body: 0xeee8e1 });
  addMesh(group, new THREE.BoxGeometry(5.2, 3.2, 6.0), mat(0xc26b3a, { roughness: 0.55 }), -6.4, 1.9, 0.4);
  // sawtooth clerestory
  for (const x of [-7.6, -6.4, -5.2]) addMesh(group, new THREE.BoxGeometry(1.0, 1.1, 6.0), mat(0x7eafd2, { roughness: 0.15, metalness: 0.3, opacity: 0.55 }), x, 3.9, 0.4);
}

function buildSupport(group, def) {
  officeBuilding(group, def, { w: 8.2, d: 7.4, stories: 4, accent: 0x1f9bc7, body: 0xf0f6f9 });
  addMesh(group, new THREE.CylinderGeometry(1.3, 1.5, 8.5, 14), mat(0xf0f6f9), 5.2, 4.5, -1.2);
  addMesh(group, new THREE.CylinderGeometry(1.55, 1.55, 0.3, 14), mat(0x1f9bc7, { emissive: 0x1f9bc7, emissiveIntensity: 0.25 }), 5.2, 8.9, -1.2);
}

const builders = {
  castle: buildCommand, finance: buildFinance, sales: buildSales, marketing: buildMarketing,
  emails: buildEmails, implementations: buildImplementations, support: buildSupport,
};

function buildLand(def) {
  const group = new THREE.Group();
  group.name = def.name;
  group.position.set(def.x, 0, def.z);
  group.userData.landId = def.id;
  addMesh(group, new THREE.BoxGeometry(def.radius * 2.3, 0.12, def.radius * 2.3), mat(0xdfe3e8, { roughness: 0.9 }), 0, 0.08, 0).receiveShadow = true;
  (builders[def.id] || officeBuilding.bind(null, group, def, { w: 8, d: 7, stories: 4, accent: def.ink }))(group, def);

  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(def.radius * 2.1, 16, def.radius * 2.1),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 8;
  hit.userData.landId = def.id;
  group.add(hit);
  hitTargets.push(hit);

  if (newCountFor(def.id) > 0) {
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.4, 8, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
    );
    beacon.position.y = 16;
    group.add(beacon);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd9f1ff, transparent: true, opacity: 0.9 })
    );
    orb.position.y = 20.5;
    group.add(orb);
    landBeacons.set(def.id, { beacon, orb });
  }
  landGroups.set(def.id, group);
  return group;
}

function pathTo(ax, az, bx, bz, width = 2.4) {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(width, 0.08, len), mat(0xd9d4cb, { roughness: 0.92 }));
  m.position.set((ax + bx) / 2, 0.12, (az + bz) / 2);
  m.rotation.y = Math.atan2(dx, dz);
  m.receiveShadow = true;
  return m;
}

function roadRing(radius, width) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius + width / 2, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, radius - width / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, mat(0x4a4f57, { roughness: 0.88 }));
  mesh.position.y = 0.06;
  mesh.receiveShadow = true;
  return mesh;
}

function addPark(parent) {
  addMesh(parent, new THREE.CylinderGeometry(16.5, 16.5, 0.16, 40), mat(0x4e8a4a, { roughness: 0.92 }), 0, 0.14, 0).receiveShadow = true;
  addMesh(parent, new THREE.CylinderGeometry(13.5, 13.5, 0.05, 40), mat(0x57944f, { roughness: 0.92 }), 0, 0.23, 0).receiveShadow = true;
  // pond
  const pond = addMesh(parent, new THREE.CylinderGeometry(3.6, 3.8, 0.12, 24), mat(0x3a8aaa, { roughness: 0.18, metalness: 0.2 }), 0, 0.28, 5.2);
  waterPond = pond;
  // fountain
  addMesh(parent, new THREE.CylinderGeometry(1.1, 1.3, 0.4, 16), mat(0xcfc8bc, { roughness: 0.5 }), 0, 0.5, 5.2);
  addMesh(parent, new THREE.CylinderGeometry(0.22, 0.28, 1.4, 10), mat(0xcfc8bc), 0, 1.2, 5.2);
  fountainJets = new THREE.Group();
  fountainJets.position.set(0, 1.8, 5.2);
  const dropMat = mat(0xb9e3f3, { roughness: 0.2, opacity: 0.65 });
  for (let i = 0; i < 10; i++) {
    const d = addMesh(fountainJets, new THREE.SphereGeometry(0.08, 6, 6), dropMat, 0, 0, 0);
    d.castShadow = false;
    d.userData.t = i * 0.18;
  }
  parent.add(fountainJets);
  // benches around the lawn
  const benchMat = mat(0x6a5340, { roughness: 0.8 });
  const steel = mat(0x6a727a, { metalness: 0.4, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const a = i * (Math.PI / 3) + 0.4;
    const r = 11.2;
    const g = new THREE.Group();
    addMesh(g, new THREE.BoxGeometry(1.8, 0.12, 0.5), benchMat, 0, 0.45, 0);
    addMesh(g, new THREE.BoxGeometry(1.8, 0.45, 0.1), benchMat, 0, 0.75, -0.22);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.45, 0.5), steel, -0.8, 0.22, 0);
    addMesh(g, new THREE.BoxGeometry(0.1, 0.45, 0.5), steel, 0.8, 0.22, 0);
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.lookAt(0, 0, 0);
    parent.add(g);
  }
}

function scatterTrees(parent, count) {
  const trunkGeom = new THREE.CylinderGeometry(0.16, 0.22, 1.6, 7);
  const leafGeom = new THREE.SphereGeometry(1.15, 8, 6);
  const trunkMat = mat(0x5b3b24, { roughness: 0.9 });
  const leafMat = mat(0x3c8a45, { roughness: 0.75 });
  const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeom, leafMat, count);
  trunks.castShadow = leaves.castShadow = !isMobile;
  const dummy = new THREE.Object3D();
  const occupied = LAND_DEFS.map((d) => ({ x: d.x, z: d.z, r: d.radius + 3 }));
  let placed = 0, guard = 0;
  while (placed < count && guard < count * 30) {
    guard++;
    const a = Math.random() * Math.PI * 2;
    const band = Math.random();
    const r = band < 0.35 ? 8 + Math.random() * 5 : 36 + Math.random() * 22;
    const x = Math.cos(a) * r + (Math.random() - 0.5) * 3;
    const z = Math.sin(a) * r + (Math.random() - 0.5) * 3;
    if (Math.hypot(x, z) < 6) continue;
    if (occupied.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    const s = 0.75 + Math.random() * 0.7;
    dummy.position.set(x, 0.9, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = 0.9 + 1.5 * s;
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = leaves.count = placed;
  parent.add(trunks, leaves);
}

function makeClouds(parent, count) {
  clouds = new THREE.Group();
  const matC = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 1, transparent: true, opacity: 0.78, flatShading: true });
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const n = 3 + (i % 2);
    for (let k = 0; k < n; k++) {
      const s = 1.1 + Math.random() * 1.3;
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), matC);
      m.position.set((k - 1) * 1.3, Math.random() * 0.4, (Math.random() - 0.5) * 1.1);
      m.castShadow = false;
      g.add(m);
    }
    const a = (i / count) * Math.PI * 2 + 0.4;
    const r = 40 + (i % 3) * 10;
    g.position.set(Math.cos(a) * r, 34 + (i % 4) * 2.5, Math.sin(a) * r);
    g.userData.speed = 0.25 + Math.random() * 0.3;
    clouds.add(g);
  }
  parent.add(clouds);
}

function makeDrones(parent) {
  drones = new THREE.Group();
  const body = mat(0x2a3038, { metalness: 0.4, roughness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    addMesh(g, new THREE.BoxGeometry(0.45, 0.1, 0.45), body, 0, 0, 0).castShadow = false;
    addMesh(g, new THREE.BoxGeometry(0.7, 0.04, 0.08), body, 0, 0, 0).castShadow = false;
    addMesh(g, new THREE.BoxGeometry(0.08, 0.04, 0.7), body, 0, 0, 0).castShadow = false;
    g.userData = { r: 14 + i * 4, a: i * 2, h: 10 + i * 1.4, s: 0.25 + i * 0.08 };
    drones.add(g);
  }
  parent.add(drones);
}

function makeWalkers(parent) {
  const colors = [0x2c4a7c, 0x3d6b4f, 0x7a3a2e, 0x3a3a40, 0xc5b48a];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const c = colors[i % colors.length];
    addMesh(g, new THREE.CylinderGeometry(0.16, 0.18, 0.7, 8), mat(c), 0, 0.7, 0).castShadow = false;
    addMesh(g, new THREE.SphereGeometry(0.18, 8, 8), mat(0xf0d5c0), 0, 1.15, 0).castShadow = false;
    const def = LAND_DEFS[1 + (i % (LAND_DEFS.length - 1))];
    g.userData = { from: new THREE.Vector3(0, 0, 0), to: new THREE.Vector3(def.x, 0, def.z), t: i * 0.18, speed: 0.04 + i * 0.005 };
    parent.add(g);
    walkers.push(g);
  }
}

function makeSky(scene) {
  const uniforms = {
    top: { value: new THREE.Color(0x8ec8ef) },
    mid: { value: new THREE.Color(0xc5e4f7) },
    bot: { value: new THREE.Color(0xeef6fb) },
  };
  const matS = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vPos;
      void main(){ float h = normalize(vPos).y; vec3 col = mix(bot, mid, smoothstep(-0.15, 0.18, h));
      col = mix(col, top, smoothstep(0.15, 0.85, h)); gl_FragColor = vec4(col, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), matS);
  sky.name = "sky";
  scene.add(sky);
}

function syncCameraFromSpherical() {
  const offset = new THREE.Vector3().setFromSpherical(cameraRig.spherical);
  camera.position.copy(cameraRig.target).add(offset);
  camera.lookAt(cameraRig.target);
}

function setOverviewImmediate() {
  camera.position.copy(overview.pos);
  cameraRig.target.copy(overview.target);
  cameraRig.spherical.setFromVector3(new THREE.Vector3().subVectors(camera.position, cameraRig.target));
  camera.lookAt(cameraRig.target);
}

function flyTo(pos, target, dur = 1.15) {
  return new Promise((resolve) => {
    cameraRig.flying = true;
    cameraRig.flyT = 0;
    cameraRig.flyDur = dur;
    cameraRig.flyFromPos.copy(camera.position);
    cameraRig.flyFromTarget.copy(cameraRig.target);
    cameraRig.flyToPos.copy(pos);
    cameraRig.flyToTarget.copy(target);
    cameraRig.onDone = resolve;
  });
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function fadeTo(on) {
  return new Promise((resolve) => {
    if (!els.fade) { resolve(); return; }
    if (on) els.fade.classList.add('on');
    else els.fade.classList.remove('on');
    setTimeout(resolve, reducedMotion || shotMode ? 60 : 460);
  });
}

// ---------- interiors ----------
const TILES_PER_WALL = 4;

function drawTile(report, accentHex) {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 480;
  const g = c.getContext('2d');
  g.fillStyle = '#10151c';
  g.fillRect(0, 0, 768, 480);
  g.fillStyle = accentHex;
  g.fillRect(0, 0, 768, 18);
  g.fillStyle = '#1a2330';
  g.fillRect(36, 48, 160, 160);
  g.fillStyle = accentHex;
  g.beginPath();
  if (g.roundRect) g.roundRect(56, 68, 120, 120, 16);
  else g.rect(56, 68, 120, 120);
  g.fill();
  g.fillStyle = '#fff';
  g.font = '700 48px Outfit, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const monogram = (report.title || '?').replace(/[^A-Za-z0-9]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '•';
  g.fillText(monogram, 116, 128);
  if (report.isNew) {
    g.fillStyle = '#e0c266';
    g.beginPath();
    g.moveTo(560, 0); g.lineTo(768, 0); g.lineTo(768, 140); g.closePath();
    g.fill();
    g.save();
    g.translate(692, 52);
    g.rotate(0.62);
    g.fillStyle = '#1a1406';
    g.font = '700 22px Outfit, "Segoe UI", sans-serif';
    g.fillText('NEW TODAY', 0, 0);
    g.restore();
  }
  g.textAlign = 'left';
  g.fillStyle = '#f4f7fb';
  g.font = '700 36px Outfit, "Segoe UI", sans-serif';
  wrapText(g, report.title || 'Report', 220, 90, 500, 42);
  g.fillStyle = '#b7c2d0';
  g.font = '600 22px "Source Sans 3", "Segoe UI", sans-serif';
  g.fillText(fmtDate(report.date) || report.date || '', 220, 300);
  if (report.bot) g.fillText(report.bot, 220, 334);
  g.fillStyle = accentHex;
  g.fillRect(0, 456, 768, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function wrapText(g, text, x, y, maxW, lineH) {
  const words = String(text).split(/\s+/);
  let line = '', yy = y, lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, yy);
      line = w;
      yy += lineH;
      if (++lines >= 3) break;
    } else line = test;
  }
  if (lines < 3 && line) g.fillText(line, x, yy);
}

function disposeObject(root) {
  if (!root) return;
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose?.();
    }
  });
}

function buildRoom(id) {
  if (roomRoot) {
    scene.remove(roomRoot);
    disposeObject(roomRoot);
  }
  roomTiles = [];
  roomDoor = null;
  roomWalls = [];
  roomWallIndex = 0;
  const theme = ROOM_THEMES[id] || ROOM_THEMES.castle;
  const def = landById[id];
  const reports = reportsByLand.get(id) || [];
  const root = new THREE.Group();
  root.name = theme.title + ' interior';
  root.position.copy(ROOM_ORIGIN);
  const W = 18, D = 16, H = 6.6;
  const wallMat = mat(theme.walls, { roughness: 0.7, side: THREE.DoubleSide });
  const floorMat = mat(theme.floor, { roughness: 0.55, side: THREE.DoubleSide });
  const ceilMat = mat(theme.ceil, { roughness: 0.8, side: THREE.DoubleSide });
  addMesh(root, new THREE.BoxGeometry(W + 0.4, 0.2, D + 0.4), floorMat, 0, 0, 0).receiveShadow = true;
  addMesh(root, new THREE.BoxGeometry(W, 0.2, D), ceilMat, 0, H, 0);
  // walls: back (-Z), left (-X), right (+X), front (+Z with door)
  addMesh(root, new THREE.BoxGeometry(W, H, 0.25), wallMat, 0, H / 2, -D / 2);
  addMesh(root, new THREE.BoxGeometry(0.25, H, D), wallMat, -W / 2, H / 2, 0);
  addMesh(root, new THREE.BoxGeometry(0.25, H, D), wallMat, W / 2, H / 2, 0);
  addMesh(root, new THREE.BoxGeometry(W, H, 0.25), wallMat, 0, H / 2, D / 2);
  // trim
  addMesh(root, new THREE.BoxGeometry(W, 0.16, 0.28), mat(theme.trim), 0, 0.2, -D / 2);
  addMesh(root, new THREE.BoxGeometry(0.28, 0.16, D), mat(theme.trim), -W / 2, 0.2, 0);
  addMesh(root, new THREE.BoxGeometry(0.28, 0.16, D), mat(theme.trim), W / 2, 0.2, 0);
  // ceiling light grid
  for (const x of [-5.2, 0, 5.2]) {
    for (const z of [-3.4, 0.4, 4.2]) {
      const fixture = addMesh(root, new THREE.BoxGeometry(2.2, 0.08, 0.7), mat(0xffffff, { emissive: 0xfff7e8, emissiveIntensity: 1.1, roughness: 0.3 }), x, H - 0.12, z);
      fixture.castShadow = false;
    }
  }
  const lamp = new THREE.PointLight(theme.light, 70, 36, 1.6);
  lamp.position.set(0, H - 0.6, 0);
  if (!isMobile) lamp.castShadow = true;
  root.add(lamp);
  const fill = new THREE.PointLight(0xffffff, 32, 30, 1.6);
  fill.position.set(0, 3.2, 3);
  root.add(fill);
  root.add(new THREE.HemisphereLight(0xffffff, theme.floor, 0.45));

  // door on front wall
  const door = addMesh(root, new THREE.BoxGeometry(2.2, 3.2, 0.16), mat(theme.wood, { roughness: 0.5 }), 0, 1.7, D / 2 - 0.2);
  addMesh(root, new THREE.BoxGeometry(2.5, 3.5, 0.1), mat(theme.trim), 0, 1.8, D / 2 - 0.12);
  const exitTex = makeSignTexture('EXIT TO MAP', '#' + new THREE.Color(theme.accent).getHexString());
  const exitSign = addMesh(root, new THREE.PlaneGeometry(2.0, 0.4), new THREE.MeshStandardMaterial({ map: exitTex, roughness: 0.4 }), 0, 3.6, D / 2 - 0.3);
  exitSign.castShadow = false;
  door.userData.isDoor = true;
  roomDoor = door;

  furnishRoom(root, theme, W, D);

  const walls = [
    { name: 'North wall', yaw: 0, axis: 'back' },
    { name: 'East wall', yaw: -Math.PI / 2, axis: 'right' },
    { name: 'West wall', yaw: Math.PI / 2, axis: 'left' },
  ];
  const chunks = [];
  for (let i = 0; i < reports.length; i += TILES_PER_WALL) chunks.push(reports.slice(i, i + TILES_PER_WALL));
  const usedWalls = walls.slice(0, Math.max(1, chunks.length));
  if (!reports.length) {
    const plaqueTex = makeSignTexture('NO REPORTS YET', '#' + new THREE.Color(theme.accent).getHexString());
    const plaque = addMesh(root, new THREE.PlaneGeometry(5.4, 1.4), new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.45 }), 0, 3.1, -D / 2 + 0.2);
    plaque.castShadow = false;
    addMesh(root, new THREE.BoxGeometry(5.8, 1.8, 0.12), mat(theme.trim), 0, 3.1, -D / 2 + 0.12);
  } else {
    usedWalls.forEach((wall, wi) => {
      const items = chunks[wi] || [];
      placeTilesOnWall(root, items, wall.axis, W, D, def.color, theme);
    });
  }
  roomWalls = usedWalls;
  root.position.copy(ROOM_ORIGIN);
  roomRoot = root;
  scene.add(root);
  updateWallHud();
}


function plant(parent, x, z, scale = 1, leaf = 0x2f7a3e) {
  const g = new THREE.Group();
  addMesh(g, new THREE.CylinderGeometry(0.22 * scale, 0.28 * scale, 0.42 * scale, 10), mat(0x8a5a3a, { roughness: 0.7 }), 0, 0.21 * scale, 0);
  addMesh(g, new THREE.SphereGeometry(0.48 * scale, 10, 8), mat(leaf, { roughness: 0.75 }), 0, 0.72 * scale, 0);
  addMesh(g, new THREE.SphereGeometry(0.32 * scale, 8, 8), mat(leaf, { roughness: 0.7 }), 0.22 * scale, 0.7 * scale, 0.1);
  g.position.set(x, 0, z);
  parent.add(g);
  return g;
}

function furnishRoom(root, theme, W, D) {
  const wood = mat(theme.wood, { roughness: 0.5 });
  const cushion = mat(theme.accent, { roughness: 0.7 });
  const fabric = mat(0xd9d2c5, { roughness: 0.8 });
  // rug
  addMesh(root, new THREE.BoxGeometry(7.2, 0.04, 4.4), mat(theme.accent, { roughness: 0.9 }), 0, 0.13, 1.4).receiveShadow = true;
  // reception desk near the door, stage left
  addMesh(root, new THREE.BoxGeometry(2.8, 1.15, 1.15), wood, -5.2, 0.7, D / 2 - 2.4);
  addMesh(root, new THREE.BoxGeometry(2.8, 0.08, 1.25), mat(theme.trim, { roughness: 0.4 }), -5.2, 1.3, D / 2 - 2.4);
  addMesh(root, new THREE.BoxGeometry(0.7, 1.0, 0.7), wood, -4.3, 0.62, D / 2 - 3.3);
  // lounge sofa + table, stage right
  addMesh(root, new THREE.BoxGeometry(3.2, 0.45, 1.15), fabric, 5.0, 0.45, 2.3);
  addMesh(root, new THREE.BoxGeometry(3.2, 0.7, 0.28), fabric, 5.0, 0.9, 1.8);
  addMesh(root, new THREE.BoxGeometry(0.28, 0.55, 1.15), fabric, 3.5, 0.85, 2.3);
  addMesh(root, new THREE.BoxGeometry(0.28, 0.55, 1.15), fabric, 6.5, 0.85, 2.3);
  addMesh(root, new THREE.BoxGeometry(3.0, 0.16, 0.22), cushion, 5.0, 0.7, 2.15);
  addMesh(root, new THREE.CylinderGeometry(0.7, 0.75, 0.12, 16), wood, 5.0, 0.42, 3.5);
  // low coffee table in front of the screens, kept short so tiles stay visible
  addMesh(root, new THREE.BoxGeometry(2.4, 0.1, 1.1), wood, 0, 0.45, 0.2);
  addMesh(root, new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), wood, -0.9, 0.22, 0.2);
  addMesh(root, new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), wood, 0.9, 0.22, 0.2);
  // corner plants
  plant(root, -W / 2 + 0.9, -D / 2 + 1.1, 1.15, 0x2f7a3e);
  plant(root, W / 2 - 0.9, -D / 2 + 1.1, 1.05, 0x3a8a48);
  plant(root, -W / 2 + 0.85, D / 2 - 1.2, 0.95, 0x2c6e38);
  plant(root, W / 2 - 0.85, D / 2 - 1.2, 1.2, 0x367a42);
  plant(root, -5.2, 3.4, 0.8, 0x3d8f4c);
}

function placeTilesOnWall(root, items, axis, W, D, accentHex, theme) {
  const n = items.length;
  const cols = n <= 2 ? n : 2;
  const rows = Math.max(1, Math.ceil(n / cols));
  const availW = W - 2.0;
  const availH = 4.55;
  const gapX = 0.28, gapY = 0.22;
  const tw = Math.min(7.6, (availW - gapX * (cols - 1)) / cols);
  const th = Math.min(3.35, (availH - gapY * (rows - 1)) / rows);
  const gridW = cols * tw + (cols - 1) * gapX;
  const gridH = rows * th + (rows - 1) * gapY;
  const x0 = -gridW / 2 + tw / 2;
  const yTop = 1.35 + gridH - th / 2;
  items.forEach((report, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ox = x0 + col * (tw + gapX);
    const oy = yTop - row * (th + gapY);
    const screen = new THREE.Group();
    const glow = addMesh(screen, new THREE.PlaneGeometry(tw + 0.42, th + 0.42), new THREE.MeshBasicMaterial({
      color: accentHex, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
    }), 0, 0, 0.01);
    glow.castShadow = false;
    glow.receiveShadow = false;
    const bezel = addMesh(screen, new THREE.BoxGeometry(tw + 0.14, th + 0.14, 0.12), mat(0x15191f, { roughness: 0.35, metalness: 0.2 }));
    const tex = drawTile(report, accentHex);
    const panel = addMesh(screen, new THREE.PlaneGeometry(tw, th), new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.32, metalness: 0.08, emissive: new THREE.Color(accentHex), emissiveIntensity: 0.22, emissiveMap: tex,
    }), 0, 0, 0.08);
    panel.castShadow = false;
    bezel.userData.report = report;
    panel.userData.report = report;
    glow.userData.report = report;
    if (axis === 'back') {
      screen.position.set(ox, oy, -D / 2 + 0.2);
    } else if (axis === 'right') {
      screen.position.set(W / 2 - 0.2, oy, ox);
      screen.rotation.y = -Math.PI / 2;
    } else {
      screen.position.set(-W / 2 + 0.2, oy, -ox);
      screen.rotation.y = Math.PI / 2;
    }
    root.add(screen);
    roomTiles.push({ group: screen, bezel, panel, glow, report, baseScale: 1 });
  });
}

function updateWallHud() {
  if (!els.wallIndicator) return;
  const n = Math.max(1, roomWalls.length);
  const wall = roomWalls[roomWallIndex] || roomWalls[0];
  els.wallIndicator.textContent = roomWalls.length
    ? `${wall.name} · ${roomWallIndex + 1} of ${n}`
    : 'Main wall';
  const show = !use2DRoom && roomWalls.length > 1;
  els.wallNav.style.visibility = show ? 'visible' : 'hidden';
}

function cycleWall(dir) {
  if (!inRoom || use2DRoom || roomWalls.length < 2) return;
  roomWallIndex = (roomWallIndex + dir + roomWalls.length) % roomWalls.length;
  roomLookTargetYaw = roomWalls[roomWallIndex].yaw;
  roomLookTargetPitch = 0;
  updateWallHud();
}

function openRoomHud(id) {
  const theme = ROOM_THEMES[id] || ROOM_THEMES.castle;
  const reports = reportsByLand.get(id) || [];
  els.roomName.textContent = theme.title;
  els.roomSub.textContent = reports.length
    ? `${theme.subtitle} · ${reports.length} report${reports.length === 1 ? '' : 's'}`
    : `${theme.subtitle} · no reports yet`;
  els.roomHud.classList.add('open');
  document.body.classList.add('in-room');
  if (els.hints) els.hints.textContent = use2DRoom ? 'Scroll to browse tiles · Exit to map' : roomHints;
}

function closeRoomHud() {
  els.roomHud.classList.remove('open');
  els.room2d.classList.remove('open');
  els.room2d.hidden = true;
  document.body.classList.remove('in-room');
  if (els.hints) els.hints.textContent = mapHints;
}

async function enterLand(id, opts = {}) {
  const def = landById[id];
  if (!def || entering) return;
  entering = true;
  enteredId = id;
  if (listOpen) setListOpen(false);
  const instant = opts.instant || !!shotMode;
  try {
    if (use2DRoom) {
      if (!instant) await fadeTo(true);
      fillRoom2D(id);
      els.room2d.hidden = false;
      els.room2d.classList.add('open');
      inRoom = true;
      openRoomHud(id);
      els.wallNav.style.visibility = 'hidden';
      if (!instant) await fadeTo(false);
      entering = false;
      return;
    }
    if (!instant) {
      const dir = new THREE.Vector3(def.camera[0], 0, def.camera[2]).normalize();
      const pos = new THREE.Vector3(def.x, 3.4, def.z).addScaledVector(dir, 8);
      const target = new THREE.Vector3(def.x, 2.6, def.z + dir.z * 0.5);
      await flyTo(pos, target, 1.05);
      await fadeTo(true);
    }
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }
    buildRoom(id);
    if (campusRoot) campusRoot.visible = false;
    if (clouds) clouds.visible = false;
    const sky = scene.getObjectByName("sky");
    if (sky) sky.visible = false;
    scene.fog = null;
    if (sun) sun.intensity = 0.35;
    renderer.setClearColor(0x1a1f28, 1);
    inRoom = true;
    roomLookYaw = 0;
    roomLookPitch = 0;
    roomLookTargetYaw = 0;
    roomLookTargetPitch = 0;
    camera.position.copy(ROOM_ORIGIN).add(new THREE.Vector3(0, 2.7, 4.8));
    camera.lookAt(ROOM_ORIGIN.clone().add(new THREE.Vector3(0, 2.55, -6)));
    openRoomHud(id);
    if (!instant) await fadeTo(false);
  } finally {
    entering = false;
  }
}

async function leaveLand() {
  if (!inRoom || entering) return;
  entering = true;
  const instant = !!shotMode;
  if (!instant) await fadeTo(true);
  if (roomRoot) {
    scene.remove(roomRoot);
    disposeObject(roomRoot);
    roomRoot = null;
  }
  roomTiles = [];
  inRoom = false;
  enteredId = null;
  if (campusRoot) campusRoot.visible = true;
  if (clouds) clouds.visible = true;
  if (sun) sun.intensity = 1.25;
  closeRoomHud();
  setOverviewImmediate();
  if (!instant) {
    await fadeTo(false);
    await flyTo(overview.pos, overview.target, 1.0);
  }
  entering = false;
}

window.__hubEnter = (id) => enterLand(id, { instant: true });
window.__hubReady = false;

// pointer / keys
const keys = new Set();
const pointer = { down: false, button: 0, lx: 0, ly: 0, moved: false };
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onPointerDown(e) {
  pointer.down = true;
  pointer.button = e.button;
  pointer.lx = e.clientX;
  pointer.ly = e.clientY;
  pointer.moved = false;
  els.canvas.setPointerCapture?.(e.pointerId);
}
function onPointerMove(e) {
  const x = e.clientX, y = e.clientY;
  mouse.x = (x / window.innerWidth) * 2 - 1;
  mouse.y = -(y / window.innerHeight) * 2 + 1;
  if (pointer.down) {
    const dx = x - pointer.lx, dy = y - pointer.ly;
    if (Math.hypot(dx, dy) > 3) pointer.moved = true;
    pointer.lx = x; pointer.ly = y;
    if (inRoom && !use2DRoom) {
      roomLookTargetYaw -= dx * 0.005;
      roomLookTargetPitch = Math.max(-0.55, Math.min(0.5, roomLookTargetPitch - dy * 0.004));
      return;
    }
    if (cameraRig.flying) return;
    if (pointer.button === 2 || pointer.button === 1 || e.shiftKey) {
      const panScale = cameraRig.spherical.radius * 0.0015;
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      cameraRig.target.addScaledVector(right, -dx * panScale * 12);
      cameraRig.target.addScaledVector(fwd, dy * panScale * 12);
    } else {
      cameraRig.spherical.theta -= dx * 0.005;
      cameraRig.spherical.phi = Math.max(cameraRig.minPhi, Math.min(cameraRig.maxPhi, cameraRig.spherical.phi - dy * 0.005));
    }
  } else {
    updateHover();
    els.tooltip.style.left = `${x}px`;
    els.tooltip.style.top = `${y}px`;
  }
}
function onPointerUp(e) {
  if (pointer.down && !pointer.moved && e.button === 0) {
    updateHover();
    if (inRoom && !use2DRoom) {
      if (hoveredTile && hoveredTile.report && hoveredTile.report.href) {
        window.open(hoveredTile.report.href, '_blank', 'noopener');
      } else if (roomDoor && hovered === 'door') {
        leaveLand();
      }
    } else if (hovered) {
      enterLand(hovered);
    }
  }
  pointer.down = false;
}
function onWheel(e) {
  if (inRoom) return;
  e.preventDefault();
  if (cameraRig.flying) return;
  cameraRig.spherical.radius = Math.max(cameraRig.minR, Math.min(cameraRig.maxR, cameraRig.spherical.radius * (1 + Math.sign(e.deltaY) * 0.08)));
}

function updateHover() {
  if (listOpen || els.search.classList.contains('open')) {
    setHovered(null);
    setTileHover(null);
    return;
  }
  raycaster.setFromCamera(mouse, camera);
  if (inRoom && !use2DRoom) {
    const tileObjs = roomTiles.flatMap((t) => [t.panel, t.bezel, t.glow].filter(Boolean));
    const hits = raycaster.intersectObjects(tileObjs.concat(roomDoor ? [roomDoor] : []), false);
    if (hits.length) {
      const obj = hits[0].object;
      if (obj.userData.isDoor) {
        setTileHover(null);
        setHovered('door');
        els.tooltip.style.display = 'block';
        els.tooltip.innerHTML = `<b>Exit to map</b><span>Leave this room</span>`;
        els.canvas.style.cursor = 'pointer';
        return;
      }
      const rec = roomTiles.find((t) => t.panel === obj || t.bezel === obj || t.glow === obj);
      setTileHover(rec || null);
      setHovered(null);
      if (rec) {
        els.tooltip.style.display = 'block';
        els.tooltip.innerHTML = `<b></b><span></span>`;
        els.tooltip.querySelector('b').textContent = rec.report.title;
        els.tooltip.querySelector('span').textContent = `${fmtDate(rec.report.date)} · ${rec.report.bot || ''}`.trim();
        els.canvas.style.cursor = 'pointer';
      }
      return;
    }
    setTileHover(null);
    setHovered(null);
    els.tooltip.style.display = 'none';
    els.canvas.style.cursor = 'grab';
    return;
  }
  const hits = raycaster.intersectObjects(hitTargets, false);
  setHovered(hits.length ? hits[0].object.userData.landId : null);
}

function setTileHover(rec) {
  if (hoveredTile === rec) return;
  if (hoveredTile) {
    hoveredTile.group.scale.setScalar(1);
    if (hoveredTile.panel.material.emissiveIntensity != null) hoveredTile.panel.material.emissiveIntensity = 0.22;
    if (hoveredTile.glow && hoveredTile.glow.material) hoveredTile.glow.material.opacity = 0.2;
  }
  hoveredTile = rec;
  if (rec) {
    rec.group.scale.setScalar(1.03);
    if (rec.panel.material.emissiveIntensity != null) rec.panel.material.emissiveIntensity = 0.5;
    if (rec.glow && rec.glow.material) rec.glow.material.opacity = 0.4;
  }
}

function setHovered(id) {
  if (hovered === id) return;
  if (hovered && landGroups.get(hovered)) setGroupEmissive(landGroups.get(hovered), 0x000000, 0);
  hovered = id;
  if (id && id !== 'door') {
    setGroupEmissive(landGroups.get(id), 0xb8d8ff, 0.16);
    const n = countFor(id);
    const extra = newCountFor(id);
    els.tooltip.style.display = 'block';
    els.tooltip.innerHTML = `<b></b><span></span>`;
    els.tooltip.querySelector('b').textContent = landById[id].name;
    els.tooltip.querySelector('span').textContent = extra
      ? `${n} report${n === 1 ? '' : 's'} · ${extra} new today`
      : `${n} report${n === 1 ? '' : 's'}`;
    els.canvas.style.cursor = 'pointer';
  } else if (id !== 'door') {
    els.tooltip.style.display = 'none';
    els.canvas.style.cursor = 'grab';
  }
}

function setGroupEmissive(group, color, intensity) {
  if (!group) return;
  group.traverse((o) => {
    if (o.isMesh && o.material && 'emissive' in o.material && !(o.material instanceof THREE.MeshBasicMaterial) && !(o.material instanceof THREE.ShaderMaterial) && !o.material.transparent) {
      o.material.emissive.setHex(color);
      o.material.emissiveIntensity = intensity;
    }
  });
}

window.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(e.target.tagName);
  if (typing) return;
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

function moveKeys(dt) {
  if (cameraRig.flying || inRoom) return;
  const speed = (keys.has('shift') ? 28 : 16) * dt;
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0; fwd.normalize();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  if (keys.has('w') || keys.has('arrowup')) cameraRig.target.addScaledVector(fwd, speed);
  if (keys.has('s') || keys.has('arrowdown')) cameraRig.target.addScaledVector(fwd, -speed);
  if (keys.has('a') || keys.has('arrowleft')) cameraRig.target.addScaledVector(right, -speed);
  if (keys.has('d') || keys.has('arrowright')) cameraRig.target.addScaledVector(right, speed);
}

const mm = els.minimap.getContext('2d');
function drawMinimap() {
  const w = els.minimap.width, h = els.minimap.height;
  mm.clearRect(0, 0, w, h);
  mm.fillStyle = '#8ebf78';
  mm.fillRect(0, 0, w, h);
  const scale = 3.15;
  const cx = w / 2, cy = h / 2;
  const toX = (x) => cx + x * scale;
  const toY = (z) => cy + z * scale;
  mm.beginPath();
  mm.strokeStyle = '#4a4f57';
  mm.lineWidth = 7;
  mm.arc(cx, cy, 34 * scale * 0.55, 0, Math.PI * 2);
  mm.stroke();
  mm.beginPath();
  mm.fillStyle = '#4e8a4a';
  mm.arc(cx, cy, 16.5 * scale, 0, Math.PI * 2);
  mm.fill();
  mm.beginPath();
  mm.fillStyle = '#3a8aaa';
  mm.arc(toX(0), toY(5.2), 3.4 * scale, 0, Math.PI * 2);
  mm.fill();
  for (const def of LAND_DEFS) {
    const x = toX(def.x), y = toY(def.z);
    mm.beginPath();
    mm.fillStyle = def.color;
    mm.fillRect(x - (def.id === 'castle' ? 6 : 5), y - (def.id === 'castle' ? 7 : 5), def.id === 'castle' ? 12 : 10, def.id === 'castle' ? 14 : 10);
    if (newCountFor(def.id)) {
      mm.beginPath();
      mm.strokeStyle = '#d9f1ff';
      mm.lineWidth = 2;
      mm.arc(x, y, 11, 0, Math.PI * 2);
      mm.stroke();
    }
    if (enteredId === def.id) {
      mm.beginPath();
      mm.strokeStyle = '#fff';
      mm.lineWidth = 2;
      mm.arc(x, y, 13, 0, Math.PI * 2);
      mm.stroke();
    }
  }
  mm.beginPath();
  mm.fillStyle = '#fff';
  mm.arc(toX(cameraRig.target.x), toY(cameraRig.target.z), 3, 0, Math.PI * 2);
  mm.fill();
}

els.minimap.addEventListener('click', (e) => {
  if (inRoom) return;
  const rect = els.minimap.getBoundingClientRect();
  const sx = els.minimap.width / rect.width, sy = els.minimap.height / rect.height;
  const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
  const scale = 3.15, cx = els.minimap.width / 2, cy = els.minimap.height / 2;
  let best = null, bestD = 22;
  for (const def of LAND_DEFS) {
    const dx = x - (cx + def.x * scale), dy = y - (cy + def.z * scale);
    const d = Math.hypot(dx, dy);
    if (d < bestD) { bestD = d; best = def.id; }
  }
  if (best) enterLand(best);
});

function initWorld() {
  renderer = new THREE.WebGLRenderer({ canvas: els.canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xc5e4f7, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd5e8f4, 70, 170);
  camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 320);
  clock = new THREE.Clock();
  setOverviewImmediate();
  makeSky(scene);

  hemi = new THREE.HemisphereLight(0xd8ecff, 0x8aa07a, 0.72);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
  sun.position.set(48, 62, 26);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -60;
    sun.shadow.camera.right = sun.shadow.camera.top = 60;
    sun.shadow.bias = -0.0004;
  }
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xb7c4d4, 0.28));

  campusRoot = new THREE.Group();
  campusRoot.name = 'BCS Campus';
  scene.add(campusRoot);
  addMesh(campusRoot, new THREE.BoxGeometry(200, 0.2, 200), mat(0x6fa35f, { roughness: 0.95 }), 0, -0.08, 0).receiveShadow = true;
  addMesh(campusRoot, new THREE.CylinderGeometry(52, 52, 0.18, 48), mat(0x5f9a55, { roughness: 0.93 }), 0, 0.04, 0).receiveShadow = true;
  campusRoot.add(roadRing(34, 5.4));
  addPark(campusRoot);
  for (const def of LAND_DEFS) {
    if (def.id === 'castle') continue;
    campusRoot.add(pathTo(0, 0, def.x, def.z, 2.5));
  }
  for (const def of LAND_DEFS) campusRoot.add(buildLand(def));
  scatterTrees(campusRoot, isMobile ? 36 : 110);
  makeClouds(scene, isMobile ? 5 : 8);
  if (!isMobile) {
    makeDrones(campusRoot);
    makeWalkers(campusRoot);
  }

  els.canvas.addEventListener('pointerdown', onPointerDown);
  els.canvas.addEventListener('pointermove', onPointerMove);
  els.canvas.addEventListener('pointerup', onPointerUp);
  els.canvas.addEventListener('pointerleave', () => { pointer.down = false; setHovered(null); });
  els.canvas.addEventListener('wheel', onWheel, { passive: false });
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', onResize);
  let lastDist = 0;
  els.canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  els.canvas.addEventListener('touchmove', (e) => {
    if (inRoom) return;
    if (e.touches.length === 2) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const delta = lastDist ? lastDist - d : 0;
      lastDist = d;
      cameraRig.spherical.radius = Math.max(cameraRig.minR, Math.min(cameraRig.maxR, cameraRig.spherical.radius * (1 + delta * 0.01)));
    }
  }, { passive: true });
}

function onResize() {
  if (!renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function applyRoomCamera() {
  roomLookYaw += (roomLookTargetYaw - roomLookYaw) * 0.12;
  roomLookPitch += (roomLookTargetPitch - roomLookPitch) * 0.12;
  const dist = 4.8;
  const eye = ROOM_ORIGIN.clone().add(new THREE.Vector3(0, 2.7, 0));
  const cy = Math.cos(roomLookPitch), sy = Math.sin(roomLookPitch);
  const sx = Math.sin(roomLookYaw), cx = Math.cos(roomLookYaw);
  camera.position.set(eye.x + sx * cy * dist, eye.y + sy * 2.0, eye.z + cx * cy * dist);
  camera.lookAt(eye.x - sx * cy * 6, eye.y - 0.15, eye.z - cx * cy * 6);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (waterPond && waterPond.material) waterPond.material.emissiveIntensity = 0.04 + Math.sin(t * 0.8) * 0.03;
  if (fountainJets && !reducedMotion) {
    for (const d of fountainJets.children) {
      const u = (t + d.userData.t) % 1.6;
      const ang = d.userData.t * 5;
      d.position.set(Math.cos(ang) * u * 0.55, u * 1.5 - u * u * 0.7, Math.sin(ang) * u * 0.55);
      d.scale.setScalar(1.1 - u * 0.4);
    }
  }
  if (clouds && !reducedMotion && clouds.visible) {
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 70) c.position.x = -70;
    }
  }
  if (drones && !reducedMotion && campusRoot.visible) {
    for (const d of drones.children) {
      d.userData.a += d.userData.s * dt;
      d.position.set(Math.cos(d.userData.a) * d.userData.r, d.userData.h, Math.sin(d.userData.a) * d.userData.r);
      d.rotation.y = -d.userData.a + Math.PI / 2;
    }
  }
  if (!reducedMotion && campusRoot.visible) {
    for (const w of walkers) {
      w.userData.t = (w.userData.t + w.userData.speed * dt) % 1;
      const u = w.userData.t < 0.5 ? w.userData.t * 2 : (1 - w.userData.t) * 2;
      w.position.lerpVectors(w.userData.from, w.userData.to, u);
      w.position.y = 0;
      const dir = w.userData.t < 0.5 ? 1 : -1;
      w.lookAt(w.userData.to.x * dir, 0, w.userData.to.z * dir);
    }
    for (const f of flags) {
      f.scale.x = 1 + Math.sin(t * 3.2) * 0.08;
      f.rotation.y = Math.sin(t * 2.2) * 0.2;
    }
  }
  for (const { beacon, orb } of landBeacons.values()) {
    const pulse = 0.7 + Math.sin(t * 2.2) * 0.3;
    orb.scale.setScalar(pulse);
    beacon.material.opacity = 0.16 + pulse * 0.12;
  }

  if (inRoom && !use2DRoom) {
    applyRoomCamera();
  } else {
    moveKeys(dt);
    if (cameraRig.flying) {
      cameraRig.flyT += dt / cameraRig.flyDur;
      const k = easeInOut(Math.min(1, cameraRig.flyT));
      camera.position.lerpVectors(cameraRig.flyFromPos, cameraRig.flyToPos, k);
      cameraRig.target.lerpVectors(cameraRig.flyFromTarget, cameraRig.flyToTarget, k);
      camera.lookAt(cameraRig.target);
      if (cameraRig.flyT >= 1) {
        cameraRig.flying = false;
        camera.position.copy(cameraRig.flyToPos);
        cameraRig.target.copy(cameraRig.flyToTarget);
        cameraRig.spherical.setFromVector3(new THREE.Vector3().subVectors(camera.position, cameraRig.target));
        const done = cameraRig.onDone;
        cameraRig.onDone = null;
        if (done) done();
      }
    } else {
      syncCameraFromSpherical();
    }
  }

  renderer.render(scene, camera);
  if (!inRoom) drawMinimap();
  requestAnimationFrame(tick);
}

function hideLoader() {
  els.loader.classList.add('hide');
  setTimeout(() => { els.loader.style.display = 'none'; }, 700);
}

async function afterStart() {
  window.__hubReady = true;
  window.__hub = {
    THREE,
    scene,
    get campusRoot() { return campusRoot; },
    get roomRoot() { return roomRoot; },
    enterLand,
    buildRoom,
    LAND_DEFS,
  };
  if (shotMode === 'room') {
    hideLoader();
    await enterLand(shotLand, { instant: true });
  } else if (shotMode === 'map') {
    hideLoader();
  } else {
    setTimeout(hideLoader, reducedMotion ? 200 : 700);
  }
}

try {
  const gl = els.canvas.getContext('webgl2') || els.canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL unavailable');
  initWorld();
  requestAnimationFrame(() => {
    tick();
    afterStart();
  });
} catch (err) {
  console.warn('Falling back to list view', err);
  els.loader.querySelector('p').textContent = 'Opening the list view…';
  setTimeout(() => {
    hideLoader();
    setListOpen(true);
  }, 400);
}
