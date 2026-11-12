import * as THREE from './vendor/three.module.min.js';

const manifest = window.HUB_MANIFEST || { today: '', generatedAt: '', lands: [] };

const LAND_DEFS = [
  { id: 'castle', name: 'Command Center', color: '#7f8cb0', ink: 0x9aa6c5, x: 0, z: 0, radius: 8, camera: [16, 14, 18] },
  { id: 'finance', name: 'Finance Land', color: '#d4a017', ink: 0xd4a017, x: 22, z: 16, radius: 7, camera: [12, 11, 14] },
  { id: 'sales', name: 'Sales Land', color: '#c45c3e', ink: 0xc45c3e, x: 26, z: -8, radius: 7, camera: [13, 11, 10] },
  { id: 'marketing', name: 'Marketing Land', color: '#8b63c9', ink: 0x8b63c9, x: 8, z: -26, radius: 7, camera: [12, 14, 10] },
  { id: 'emails', name: 'Personal Emails Land', color: '#5fa86b', ink: 0x5fa86b, x: -20, z: -16, radius: 7, camera: [-12, 10, 12] },
  { id: 'implementations', name: 'Implementations Land', color: '#a85a3c', ink: 0xa85a3c, x: -24, z: 10, radius: 7, camera: [-12, 11, 12] },
  { id: 'support', name: 'Support Land', color: '#4aa3c7', ink: 0x4aa3c7, x: -6, z: 26, radius: 7, camera: [10, 14, 14] },
];

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

function countFor(id) {
  return (reportsByLand.get(id) || []).length;
}
function newCountFor(id) {
  return (reportsByLand.get(id) || []).filter((r) => r.isNew).length;
}

const isMobile = matchMedia('(max-width: 720px), (pointer: coarse)').matches
  || (navigator.maxTouchPoints || 0) > 1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const els = {
  canvas: document.getElementById('world'),
  loader: document.getElementById('loader'),
  tooltip: document.getElementById('tooltip'),
  legendList: document.getElementById('legend-list'),
  minimap: document.getElementById('minimap'),
  panel: document.getElementById('panel'),
  panelTitle: document.getElementById('panel-title'),
  panelSub: document.getElementById('panel-sub'),
  panelBody: document.getElementById('panel-body'),
  search: document.getElementById('search'),
  searchInput: document.getElementById('search-input'),
  searchResults: document.getElementById('search-results'),
  listView: document.getElementById('list-view'),
  listBody: document.getElementById('list-body'),
  today: document.getElementById('today-label'),
  btnSearch: document.getElementById('btn-search'),
  btnList: document.getElementById('btn-list'),
  btnHelp: document.getElementById('btn-help'),
  btnBack: document.getElementById('btn-back'),
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
    ? `${fmtDate(manifest.today)} · ${n} report${n === 1 ? '' : 's'} in the archive`
    : 'Daily reports map';
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

function fillPanel(id) {
  const def = landById[id];
  const reports = reportsByLand.get(id) || [];
  els.panelTitle.textContent = def ? def.name : id;
  els.panelSub.textContent = reports.length
    ? `${reports.length} report${reports.length === 1 ? '' : 's'} · newest first`
    : 'The scribes have not yet delivered any reports to this land.';
  els.panelBody.innerHTML = '';
  if (!reports.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No reports yet. This land is ready for the next dispatch.';
    els.panelBody.appendChild(empty);
    return;
  }
  for (const r of reports) els.panelBody.appendChild(reportButton(r));
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
  const rows = allReports().filter((r) => {
    if (!query) return true;
    return [r.title, r.bot, r.landName, r.date].join(' ').toLowerCase().includes(query);
  });
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
    li.querySelector('span').textContent = def.name.replace(/ Land$/, '');
    li.querySelector('.count').textContent = String(countFor(def.id));
    const go = () => enterLand(def.id);
    li.addEventListener('click', go);
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    els.legendList.appendChild(li);
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
els.btnBack.addEventListener('click', () => leaveLand());
els.btnHelp.addEventListener('click', () => {
  alert('Explore the island:\n\n• Drag to orbit, right-drag or two-finger drag to pan, scroll or pinch to zoom\n• WASD or arrow keys move around the map\n• Hover a landmark to see its name and report count\n• Click a building to fly there and read that land’s reports\n• Search (or press /) jumps to any report\n• List view is a plain, accessible catalog');
});
els.search.addEventListener('click', (e) => { if (e.target === els.search) setSearchOpen(false); });
els.searchInput.addEventListener('input', () => renderSearch(els.searchInput.value));
window.addEventListener('keydown', (e) => {
  const typing = /input|textarea/i.test(e.target.tagName);
  if (e.key === 'Escape') {
    setSearchOpen(false);
    if (els.panel.classList.contains('open')) leaveLand();
    if (listOpen) setListOpen(false);
  } else if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) && !typing) {
    e.preventDefault();
    setSearchOpen(true);
  }
});

buildLegend();
renderList();

// ---------------------------------------------------------------------------
// 3D world
// ---------------------------------------------------------------------------
let renderer, scene, camera, clock;
let water, windmillBlades, lighthouseBeam, smokePuffs, clouds, birds, sunMesh;
const landGroups = new Map();
const landBeacons = new Map();
const hitTargets = [];
const animated = [];
let hovered = null;
let enteredId = null;
let webglOk = true;

const cameraRig = {
  target: new THREE.Vector3(0, 2, 0),
  spherical: new THREE.Spherical(62, 1.05, 0.55),
  pan: new THREE.Vector3(),
  minR: 16,
  maxR: 120,
  minPhi: 0.25,
  maxPhi: 1.35,
  flying: false,
  flyFromPos: new THREE.Vector3(),
  flyFromTarget: new THREE.Vector3(),
  flyToPos: new THREE.Vector3(),
  flyToTarget: new THREE.Vector3(),
  flyT: 0,
  flyDur: 1.15,
};

const overview = { pos: new THREE.Vector3(38, 42, 52), target: new THREE.Vector3(0, 2, 0) };

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.72, metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
    flatShading: opts.flat !== false, transparent: !!opts.opacity, opacity: opts.opacity ?? 1,
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

function makeIslandShape(radius) {
  const shape = new THREE.Shape();
  const pts = 18;
  const coords = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
    const n = 0.82 + 0.14 * Math.sin(i * 1.7 + 0.4) + 0.1 * Math.cos(i * 2.9 + 1.1);
    coords.push([Math.cos(a) * radius * n, Math.sin(a) * radius * n]);
  }
  shape.moveTo(coords[0][0], coords[0][1]);
  for (let i = 0; i < pts; i++) {
    const curr = coords[i];
    const next = coords[(i + 1) % pts];
    shape.quadraticCurveTo(curr[0], curr[1], (curr[0] + next[0]) / 2, (curr[1] + next[1]) / 2);
  }
  shape.closePath();
  return shape;
}

function extrudeFlat(shape, depth, color, y, extra = {}) {
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: extra.bevel ?? 0.35, bevelSize: extra.bevel ?? 0.35, bevelSegments: 2, steps: 1,
  });
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, mat(color, { roughness: extra.roughness ?? 0.85 }));
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function roadBetween(a, b, y = 1.16) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const g = new THREE.BoxGeometry(1.15, 0.08, len);
  const m = new THREE.Mesh(g, mat(0xc4a574, { roughness: 0.9 }));
  m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  m.rotation.y = Math.atan2(dx, dz);
  m.receiveShadow = true;
  return m;
}

// ---------- landmarks ----------
function buildCastle(group) {
  const stone = mat(0x8b919c, { roughness: 0.78 });
  const dark = mat(0x5e646e);
  const roof = mat(0x2e5cb8, { roughness: 0.45 });
  const gold = mat(0xd4a84b, { metalness: 0.55, roughness: 0.35, emissive: 0x3a2a08, emissiveIntensity: 0.2 });
  const flag = mat(0xd4a84b, { roughness: 0.55 });
  addMesh(group, new THREE.BoxGeometry(8, 1.1, 8), dark, 0, 0.55, 0);
  addMesh(group, new THREE.BoxGeometry(6.2, 9.2, 6.2), stone, 0, 5.7, 0);
  addMesh(group, new THREE.BoxGeometry(2.2, 3.2, 1), dark, 0, 2.2, 3.2);
  const corners = [[-3.4, -3.4], [3.4, -3.4], [-3.4, 3.4], [3.4, 3.4]];
  for (const [x, z] of corners) {
    addMesh(group, new THREE.CylinderGeometry(1.05, 1.15, 10, 8), stone, x, 5.6, z);
    addMesh(group, new THREE.ConeGeometry(1.4, 2.2, 8), roof, x, 11.7, z);
    addMesh(group, new THREE.SphereGeometry(0.18, 8, 8), gold, x, 12.9, z);
  }
  addMesh(group, new THREE.BoxGeometry(2.4, 2.6, 2.4), stone, 0, 10.3, 0);
  addMesh(group, new THREE.ConeGeometry(2.0, 3.2, 8), roof, 0, 13.1, 0);
  addMesh(group, new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), dark, 0, 15.1, 0);
  const banner = addMesh(group, new THREE.PlaneGeometry(1.1, 0.7), flag, 0.55, 15.0, 0);
  banner.material.side = THREE.DoubleSide;
  for (let i = -3; i <= 3; i++) {
    addMesh(group, new THREE.BoxGeometry(0.45, 0.7, 0.45), stone, i * 1.05, 9.3, 3.15);
    addMesh(group, new THREE.BoxGeometry(0.45, 0.7, 0.45), stone, i * 1.05, 9.3, -3.15);
  }
}

function buildFinance(group) {
  const lime = mat(0xe6dcc8, { roughness: 0.7 });
  const step = mat(0xd9d0b8);
  const gold = mat(0xd4a017, { metalness: 0.6, roughness: 0.32, emissive: 0x3a2800, emissiveIntensity: 0.25 });
  addMesh(group, new THREE.BoxGeometry(8, 0.4, 8), step, 0, 0.2, 0);
  addMesh(group, new THREE.BoxGeometry(6.6, 0.35, 6.6), step, 0, 0.5, 0);
  addMesh(group, new THREE.BoxGeometry(6, 3.4, 5.2), lime, 0, 2.3, 0);
  for (const x of [-2.2, 0, 2.2]) {
    addMesh(group, new THREE.CylinderGeometry(0.28, 0.32, 3.6, 10), lime, x, 2.5, 2.7);
  }
  addMesh(group, new THREE.BoxGeometry(6.4, 0.35, 1.2), lime, 0, 4.35, 2.55);
  addMesh(group, new THREE.CylinderGeometry(1.7, 1.9, 1.2, 16), lime, 0, 4.7, 0);
  addMesh(group, new THREE.SphereGeometry(2.05, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 5.3, 0);
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 1.1, 8), gold, 0, 6.7, 0);
  addMesh(group, new THREE.SphereGeometry(0.2, 8, 8), gold, 0, 7.3, 0);
  addMesh(group, new THREE.CylinderGeometry(0.35, 0.4, 0.4, 10), gold, -2.6, 0.55, 3.3);
  addMesh(group, new THREE.CylinderGeometry(0.28, 0.32, 0.55, 10), gold, -2.2, 0.62, 3.5);
}

function buildSales(group) {
  const wall = mat(0xf0e2cf);
  const roof = mat(0xc45c3e);
  const trim = mat(0x7a3a28);
  addMesh(group, new THREE.BoxGeometry(8.4, 3.6, 4.6), wall, 0, 2.1, 0);
  const roofMesh = addMesh(group, new THREE.ConeGeometry(0.1, 0.1, 4), roof, 0, 0, 0);
  roofMesh.geometry.dispose();
  roofMesh.geometry = new THREE.BoxGeometry(8.9, 0.25, 5.2);
  roofMesh.position.set(0, 4.1, 0);
  const peak = addMesh(group, new THREE.CylinderGeometry(0.01, 3.6, 2.2, 4), roof, 0, 5.2, 0);
  peak.rotation.y = Math.PI / 4;
  peak.scale.set(2.4, 1, 0.55);
  addMesh(group, new THREE.BoxGeometry(1.5, 2.2, 0.3), trim, 0, 1.3, 2.35);
  const tentColors = [0xc45c3e, 0xd4a017, 0x3d6ea8];
  [-2.6, 0, 2.6].forEach((x, i) => {
    addMesh(group, new THREE.ConeGeometry(1.15, 2.0, 8), mat(tentColors[i]), x, 1.4, 4.4);
    addMesh(group, new THREE.CylinderGeometry(1.0, 1.0, 0.7, 8), mat(0xf3e6d0), x, 0.35, 4.4);
  });
  addMesh(group, new THREE.BoxGeometry(0.7, 0.5, 0.55), trim, 3.6, 0.45, 3.2);
  addMesh(group, new THREE.BoxGeometry(0.55, 0.4, 0.5), mat(0x8a5a2b), 4.1, 0.4, 3.0);
}

function buildMarketing(group) {
  const tower = mat(0xf3efe6);
  const band = mat(0x8b63c9);
  const wood = mat(0x6a4a2a);
  addMesh(group, new THREE.CylinderGeometry(1.5, 1.9, 7.5, 12), tower, 0, 3.9, 0);
  addMesh(group, new THREE.TorusGeometry(1.55, 0.12, 8, 16), band, 0, 5.6, 0, Math.PI / 2);
  addMesh(group, new THREE.CylinderGeometry(2.0, 2.1, 0.5, 12), wood, 0, 7.7, 0);
  const blades = new THREE.Group();
  blades.position.set(0, 6.4, 1.55);
  const bladeMat = mat(0xf7f1e3);
  for (let i = 0; i < 4; i++) {
    const arm = addMesh(blades, new THREE.BoxGeometry(0.22, 5.2, 0.7), bladeMat, 0, 0, 0);
    arm.rotation.z = (i * Math.PI) / 2;
    arm.position.set(0, 0, 0);
  }
  addMesh(blades, new THREE.SphereGeometry(0.35, 10, 10), band, 0, 0, 0.15);
  group.add(blades);
  windmillBlades = blades;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = 4.4 + (i % 3) * 0.4;
    const c = [0x8b63c9, 0xe07ab5, 0xd4a017, 0x59a0d8][i % 4];
    addMesh(group, new THREE.SphereGeometry(0.22, 8, 8), mat(c, { roughness: 0.5 }), Math.cos(a) * r, 0.35, Math.sin(a) * r);
  }
  addMesh(group, new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6), wood, 3.4, 1.8, 3.2);
  addMesh(group, new THREE.PlaneGeometry(1.3, 0.9), band, 4.05, 2.8, 3.2).material.side = THREE.DoubleSide;
}

function buildEmails(group) {
  const wall = mat(0xf4ead6);
  const thatch = mat(0xb56b3a, { roughness: 0.9 });
  const wood = mat(0x6a4330);
  const green = mat(0x3e7a4a);
  addMesh(group, new THREE.BoxGeometry(6.4, 3.4, 5.0), wall, 0, 2.0, 0);
  const roof = addMesh(group, new THREE.ConeGeometry(0.1, 0.1, 4), thatch);
  roof.geometry.dispose();
  roof.geometry = new THREE.CylinderGeometry(0.2, 4.6, 2.6, 4);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 4.9, 0);
  roof.scale.set(1.15, 1, 0.85);
  addMesh(group, new THREE.CylinderGeometry(0.35, 0.4, 1.6, 8), mat(0x8a8f96), 1.8, 5.5, -0.4);
  addMesh(group, new THREE.BoxGeometry(1.2, 2.0, 0.25), wood, 0, 1.2, 2.55);
  addMesh(group, new THREE.BoxGeometry(0.9, 0.9, 0.12), green, -1.7, 2.3, 2.56);
  addMesh(group, new THREE.BoxGeometry(0.9, 0.9, 0.12), green, 1.7, 2.3, 2.56);
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.18, 2.6, 8), wood, 3.6, 1.3, 2.2);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.85, 0.5), mat(0x3d4a62), 3.6, 2.7, 2.2);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.5, 0.05), mat(0xd4a017), 3.6, 3.2, 2.2);
  // smoke
  smokePuffs = new THREE.Group();
  smokePuffs.position.set(1.8, 6.5, -0.4);
  for (let i = 0; i < 4; i++) {
    const p = addMesh(smokePuffs, new THREE.SphereGeometry(0.28 + i * 0.05, 8, 8), mat(0xcdd3da, { opacity: 0.45, roughness: 1 }), 0, i * 0.4, 0);
    p.castShadow = false;
    p.userData.t = i * 0.8;
  }
  group.add(smokePuffs);
}

function buildImplementations(group) {
  const brick = mat(0xa85a3c, { roughness: 0.8 });
  const timber = mat(0x4a2f22);
  const iron = mat(0x5b5f66, { metalness: 0.4, roughness: 0.45 });
  const ember = mat(0xff6a1a, { emissive: 0xff4a00, emissiveIntensity: 0.7, roughness: 0.4 });
  addMesh(group, new THREE.BoxGeometry(7.2, 3.8, 5.4), brick, 0, 2.1, 0);
  addMesh(group, new THREE.BoxGeometry(7.6, 0.35, 5.8), timber, 0, 4.1, 0);
  addMesh(group, new THREE.BoxGeometry(2.4, 1.6, 5.8), brick, -2.2, 5.0, 0);
  addMesh(group, new THREE.CylinderGeometry(0.55, 0.65, 3.2, 10), brick, -2.2, 7.2, 0);
  addMesh(group, new THREE.CylinderGeometry(0.7, 0.7, 0.3, 10), iron, -2.2, 8.8, 0);
  addMesh(group, new THREE.BoxGeometry(1.6, 2.0, 0.2), timber, 1.5, 1.2, 2.75);
  addMesh(group, new THREE.BoxGeometry(1.2, 1.0, 0.8), ember, 1.5, 0.7, 1.8);
  // scaffolding
  for (const x of [-3.9, 3.9]) {
    addMesh(group, new THREE.BoxGeometry(0.15, 5.2, 0.15), timber, x, 2.6, 2.9);
    addMesh(group, new THREE.BoxGeometry(0.15, 5.2, 0.15), timber, x, 2.6, -2.9);
    addMesh(group, new THREE.BoxGeometry(0.15, 0.15, 5.8), timber, x, 3.4, 0);
  }
  addMesh(group, new THREE.CylinderGeometry(0.12, 0.5, 0.7, 10), iron, 3.2, 0.55, 3.4);
}

function buildSupport(group) {
  const white = mat(0xf4f1ea);
  const red = mat(0xc43b3b);
  const rock = mat(0x6b717a, { roughness: 0.9 });
  const glass = mat(0xfff2b0, { emissive: 0xffd66e, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1 });
  addMesh(group, new THREE.CylinderGeometry(3.2, 3.8, 1.6, 8), rock, 0, 0.8, 0);
  addMesh(group, new THREE.CylinderGeometry(1.15, 1.55, 8.4, 12), white, 0, 5.4, 0);
  addMesh(group, new THREE.CylinderGeometry(1.25, 1.25, 0.8, 12), red, 0, 5.0, 0);
  addMesh(group, new THREE.CylinderGeometry(1.2, 1.2, 0.8, 12), red, 0, 7.4, 0);
  addMesh(group, new THREE.CylinderGeometry(1.35, 1.35, 1.4, 12), glass, 0, 10.3, 0);
  addMesh(group, new THREE.ConeGeometry(1.6, 1.8, 10), red, 0, 11.8, 0);
  addMesh(group, new THREE.BoxGeometry(2.6, 1.8, 2.2), white, 3.1, 1.3, 1.2);
  addMesh(group, new THREE.BoxGeometry(2.9, 0.25, 2.5), mat(0x7a3a28), 3.1, 2.25, 1.2);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 18, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })
  );
  beam.position.set(0, 10.3, 9);
  beam.rotation.x = Math.PI / 2;
  group.add(beam);
  lighthouseBeam = beam;
  // short dock
  const plank = mat(0x8a6840, { roughness: 0.9 });
  addMesh(group, new THREE.BoxGeometry(2.2, 0.18, 7), plank, 0.5, 0.55, 7.2);
  for (const z of [4.5, 7.2, 9.8]) addMesh(group, new THREE.CylinderGeometry(0.12, 0.12, 1.1, 6), plank, -0.5, 0.3, z);
}

const builders = {
  castle: buildCastle,
  finance: buildFinance,
  sales: buildSales,
  marketing: buildMarketing,
  emails: buildEmails,
  implementations: buildImplementations,
  support: buildSupport,
};

function landPlotColor(id) {
  return {
    castle: 0x6f7b62,
    finance: 0xc7b56a,
    sales: 0xb56b4a,
    marketing: 0x7a6a93,
    emails: 0x4f8a55,
    implementations: 0x7a5a42,
    support: 0x4d7e8a,
  }[id] || 0x4f8a55;
}

function buildLand(def) {
  const group = new THREE.Group();
  group.position.set(def.x, 1.15, def.z);
  group.userData.landId = def.id;
  addMesh(group, new THREE.CylinderGeometry(def.radius, def.radius + 0.6, 0.55, 16), mat(landPlotColor(def.id), { roughness: 0.9 }), 0, 0.1, 0).receiveShadow = true;
  const ring = addMesh(group, new THREE.TorusGeometry(def.radius * 0.92, 0.08, 6, 24), mat(def.ink, { roughness: 0.5, metalness: 0.15 }), 0, 0.4, 0, Math.PI / 2);
  ring.castShadow = false;
  const bld = new THREE.Group();
  (builders[def.id] || buildEmails)(bld);
  group.add(bld);

  const hit = new THREE.Mesh(
    new THREE.CylinderGeometry(def.radius * 0.95, def.radius * 0.95, 12, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = 6;
  hit.userData.landId = def.id;
  group.add(hit);
  hitTargets.push(hit);

  if (newCountFor(def.id) > 0) {
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.55, 10, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide })
    );
    beacon.position.y = 14;
    group.add(beacon);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.9 })
    );
    orb.position.y = 19;
    group.add(orb);
    landBeacons.set(def.id, { beacon, orb });
  }
  landGroups.set(def.id, group);
  return group;
}

function scatterTrees(parent, count) {
  const trunkGeom = new THREE.CylinderGeometry(0.14, 0.2, 1.3, 6);
  const leafGeom = new THREE.ConeGeometry(0.95, 2.2, 7);
  const trunkMat = mat(0x5b3b24, { roughness: 0.9 });
  const leafMats = [mat(0x2f6a38), mat(0x3d7d42), mat(0x255c30)];
  const trunks = new THREE.InstancedMesh(trunkGeom, trunkMat, count);
  const leaves = new THREE.InstancedMesh(leafGeom, leafMats[0], count);
  trunks.castShadow = leaves.castShadow = !isMobile;
  const dummy = new THREE.Object3D();
  const occupied = LAND_DEFS.map((d) => ({ x: d.x, z: d.z, r: d.radius + 2.2 }));
  let placed = 0, guard = 0;
  while (placed < count && guard < count * 20) {
    guard++;
    const a = Math.random() * Math.PI * 2;
    const r = 10 + Math.random() * 32;
    const x = Math.cos(a) * r + (Math.random() - 0.5) * 8;
    const z = Math.sin(a) * r + (Math.random() - 0.5) * 8;
    if (Math.hypot(x, z) > 38) continue;
    if (occupied.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    const s = 0.7 + Math.random() * 0.9;
    dummy.position.set(x, 1.55, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, Math.random() * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = 1.55 + 1.4 * s;
    dummy.updateMatrix();
    leaves.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  trunks.count = leaves.count = placed;
  parent.add(trunks, leaves);
}

function makeClouds(parent, count) {
  clouds = new THREE.Group();
  const matC = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, roughness: 1, transparent: true, opacity: 0.86, flatShading: true });
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const n = 3 + (i % 3);
    for (let k = 0; k < n; k++) {
      const s = 1.6 + Math.random() * 2.2;
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 6), matC);
      m.position.set((k - 1) * 1.6, Math.random() * 0.6, (Math.random() - 0.5) * 1.4);
      m.castShadow = false;
      g.add(m);
    }
    let x = (Math.random() - 0.5) * 90;
    let z = (Math.random() - 0.5) * 90;
    if (Math.hypot(x, z) < 18) {
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * (22 + Math.random() * 30);
      z = Math.sin(a) * (22 + Math.random() * 30);
    }
    g.position.set(x, 30 + Math.random() * 10, z);
    g.userData.speed = 0.4 + Math.random() * 0.6;
    clouds.add(g);
  }
  parent.add(clouds);
}

function makeBirds(parent) {
  birds = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: 0x2a2e33 });
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.45, 0, 0, 0, 0, 0, 0, 0.18, 0,
      0, 0, 0, 0.45, 0, 0, 0, 0.18, 0,
    ], 3));
    const mesh = new THREE.Mesh(g, m);
    mesh.userData = { r: 10 + i * 2, a: i, h: 16 + (i % 3) * 1.5, s: 0.4 + i * 0.05 };
    birds.add(mesh);
  }
  parent.add(birds);
}

function makeWater() {
  const uniforms = {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0b4a66) },
    uColorShallow: { value: new THREE.Color(0x2a8aaa) },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 p = position;
        float w = sin(p.x * 0.18 + uTime * 0.7) * 0.18 + cos(p.y * 0.16 + uTime * 0.55) * 0.14;
        p.z += w;
        vWave = w;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorDeep;
      uniform vec3 uColorShallow;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        float f = smoothstep(0.0, 1.0, length(vUv - 0.5) * 1.6);
        vec3 col = mix(uColorShallow, uColorDeep, f);
        col += vWave * 0.15;
        gl_FragColor = vec4(col, 0.88);
      }
    `,
  });
  const geom = new THREE.PlaneGeometry(160, 160, isMobile ? 32 : 80, isMobile ? 32 : 80);
  water = new THREE.Mesh(geom, material);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  return water;
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

function flyTo(pos, target) {
  cameraRig.flying = true;
  cameraRig.flyT = 0;
  cameraRig.flyFromPos.copy(camera.position);
  cameraRig.flyFromTarget.copy(cameraRig.target);
  cameraRig.flyToPos.copy(pos);
  cameraRig.flyToTarget.copy(target);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function enterLand(id) {
  const def = landById[id];
  if (!def) return;
  enteredId = id;
  fillPanel(id);
  els.panel.classList.add('open');
  const target = new THREE.Vector3(def.x, 3.5, def.z);
  const pos = new THREE.Vector3(def.x + def.camera[0], def.camera[1] + 2, def.z + def.camera[2]);
  flyTo(pos, target);
}

function leaveLand() {
  enteredId = null;
  els.panel.classList.remove('open');
  flyTo(overview.pos, overview.target);
}

// pointer / keys
const keys = new Set();
const pointer = { down: false, button: 0, lx: 0, ly: 0, moved: false, pinch: 0 };
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
    if (cameraRig.flying) return;
    if (pointer.button === 2 || pointer.button === 1 || e.shiftKey) {
      const panScale = cameraRig.spherical.radius * 0.0015;
      const right = new THREE.Vector3();
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      fwd.y = 0; fwd.normalize();
      right.crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
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
    if (hovered) enterLand(hovered);
  }
  pointer.down = false;
}
function onWheel(e) {
  e.preventDefault();
  if (cameraRig.flying) return;
  cameraRig.spherical.radius = Math.max(cameraRig.minR, Math.min(cameraRig.maxR, cameraRig.spherical.radius * (1 + Math.sign(e.deltaY) * 0.08)));
}

function updateHover() {
  if (listOpen || els.search.classList.contains('open')) {
    setHovered(null);
    return;
  }
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(hitTargets, false);
  setHovered(hits.length ? hits[0].object.userData.landId : null);
}

function setHovered(id) {
  if (hovered === id) return;
  if (hovered && landGroups.get(hovered)) setGroupEmissive(landGroups.get(hovered), 0x000000, 0);
  hovered = id;
  if (id) {
    setGroupEmissive(landGroups.get(id), 0xffe08a, 0.18);
    const n = countFor(id);
    const extra = newCountFor(id);
    els.tooltip.style.display = 'block';
    els.tooltip.innerHTML = `<b></b><span></span>`;
    els.tooltip.querySelector('b').textContent = landById[id].name;
    els.tooltip.querySelector('span').textContent = extra
      ? `${n} report${n === 1 ? '' : 's'} · ${extra} new today`
      : `${n} report${n === 1 ? '' : 's'}`;
    els.canvas.style.cursor = 'pointer';
  } else {
    els.tooltip.style.display = 'none';
    els.canvas.style.cursor = 'grab';
  }
}

function setGroupEmissive(group, color, intensity) {
  group.traverse((o) => {
    if (o.isMesh && o.material && 'emissive' in o.material && o.material.visible !== false && !(o.material instanceof THREE.MeshBasicMaterial) && !(o.material instanceof THREE.ShaderMaterial)) {
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
  if (cameraRig.flying) return;
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

// minimap
const mm = els.minimap.getContext('2d');
function drawMinimap() {
  const w = els.minimap.width, h = els.minimap.height;
  mm.clearRect(0, 0, w, h);
  mm.fillStyle = '#12344a';
  mm.fillRect(0, 0, w, h);
  const scale = 3.6;
  const cx = w / 2, cy = h / 2;
  const toX = (x) => cx + x * scale;
  const toY = (z) => cy + z * scale;
  mm.beginPath();
  mm.fillStyle = '#3d7a4a';
  mm.arc(cx, cy, 38 * scale * 0.22 + 46, 0, Math.PI * 2);
  mm.fill();
  for (const def of LAND_DEFS) {
    const x = toX(def.x), y = toY(def.z);
    mm.beginPath();
    mm.fillStyle = def.color;
    mm.arc(x, y, def.id === 'castle' ? 8 : 6, 0, Math.PI * 2);
    mm.fill();
    if (newCountFor(def.id)) {
      mm.beginPath();
      mm.strokeStyle = '#ffe08a';
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
  // camera
  mm.beginPath();
  mm.fillStyle = '#fff';
  mm.arc(toX(cameraRig.target.x), toY(cameraRig.target.z), 3, 0, Math.PI * 2);
  mm.fill();
}

els.minimap.addEventListener('click', (e) => {
  const rect = els.minimap.getBoundingClientRect();
  const sx = els.minimap.width / rect.width, sy = els.minimap.height / rect.height;
  const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
  const scale = 3.6, cx = els.minimap.width / 2, cy = els.minimap.height / 2;
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
  renderer.setClearColor(0x7eafd4, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8ebcd8, 55, 140);
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
  clock = new THREE.Clock();
  setOverviewImmediate();

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3d4a2a, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
  sun.position.set(40, 55, 18);
  if (!isMobile) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 140;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -50;
    sun.shadow.camera.right = sun.shadow.camera.top = 50;
    sun.shadow.bias = -0.0004;
  }
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6f8499, 0.25));

  sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe7b0 })
  );
  sunMesh.position.set(60, 42, 28);
  scene.add(sunMesh);

  scene.add(makeWater());
  const beach = extrudeFlat(makeIslandShape(44), 0.7, 0xe8d5a3, 0.15, { bevel: 0.5 });
  scene.add(beach);
  const land = extrudeFlat(makeIslandShape(39), 1.15, 0x3d7a45, 0.55, { bevel: 0.45 });
  scene.add(land);
  // central hill under the castle
  addMesh(scene, new THREE.CylinderGeometry(11, 13, 1.3, 16), mat(0x4b8750, { roughness: 0.9 }), 0, 1.4, 0);

  for (const def of LAND_DEFS) {
    if (def.id === 'castle') continue;
    scene.add(roadBetween({ x: 0, z: 0 }, def, 1.22));
  }
  for (const def of LAND_DEFS) scene.add(buildLand(def));
  scatterTrees(scene, isMobile ? 40 : 140);
  makeClouds(scene, isMobile ? 5 : 10);
  if (!isMobile) makeBirds(scene);

  // distant rocks
  for (let i = 0; i < 8; i++) {
    const a = i * 0.8 + 0.3;
    const r = 42 + (i % 3) * 3;
    addMesh(scene, new THREE.DodecahedronGeometry(1.4 + (i % 3) * 0.7, 0), mat(0x6b717a, { roughness: 0.95 }), Math.cos(a) * r, 0.9, Math.sin(a) * r);
  }

  els.canvas.addEventListener('pointerdown', onPointerDown);
  els.canvas.addEventListener('pointermove', onPointerMove);
  els.canvas.addEventListener('pointerup', onPointerUp);
  els.canvas.addEventListener('pointerleave', () => { pointer.down = false; setHovered(null); });
  els.canvas.addEventListener('wheel', onWheel, { passive: false });
  els.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', onResize);

  // touch pinch
  let lastDist = 0;
  els.canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) lastDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  els.canvas.addEventListener('touchmove', (e) => {
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

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (water) water.material.uniforms.uTime.value = t;
  if (windmillBlades && !reducedMotion) windmillBlades.rotation.z = t * 0.6;
  if (lighthouseBeam && !reducedMotion) lighthouseBeam.rotation.y = t * 0.45;
  if (lighthouseBeam) lighthouseBeam.position.set(Math.sin(t * 0.45) * 9, 10.3, Math.cos(t * 0.45) * 9);
  if (smokePuffs && !reducedMotion) {
    for (const p of smokePuffs.children) {
      const u = (t + p.userData.t) % 3.2;
      p.position.y = u * 0.7;
      p.position.x = Math.sin((t + p.userData.t) * 0.7) * 0.2;
      p.material.opacity = 0.4 * (1 - u / 3.2);
      const s = 0.8 + u * 0.35;
      p.scale.setScalar(s);
    }
  }
  if (clouds && !reducedMotion) {
    for (const c of clouds.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 50) c.position.x = -50;
    }
  }
  if (birds && !reducedMotion) {
    for (const b of birds.children) {
      b.userData.a += b.userData.s * dt;
      b.position.set(Math.cos(b.userData.a) * b.userData.r, b.userData.h + Math.sin(t * 2 + b.userData.a) * 0.3, Math.sin(b.userData.a) * b.userData.r);
      b.rotation.y = -b.userData.a;
    }
  }
  for (const { beacon, orb } of landBeacons.values()) {
    const pulse = 0.7 + Math.sin(t * 2.4) * 0.3;
    orb.scale.setScalar(pulse);
    beacon.material.opacity = 0.18 + pulse * 0.12;
  }

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
    }
  } else {
    syncCameraFromSpherical();
  }

  renderer.render(scene, camera);
  drawMinimap();
  requestAnimationFrame(tick);
}

function hideLoader() {
  els.loader.classList.add('hide');
  setTimeout(() => { els.loader.style.display = 'none'; }, 700);
}

try {
  const gl = els.canvas.getContext('webgl2') || els.canvas.getContext('webgl');
  if (!gl) throw new Error('WebGL unavailable');
  initWorld();
  requestAnimationFrame(() => {
    tick();
    setTimeout(hideLoader, reducedMotion ? 200 : 700);
  });
} catch (err) {
  webglOk = false;
  console.warn('Falling back to list view', err);
  els.loader.querySelector('p').textContent = 'Opening the list view…';
  setTimeout(() => {
    hideLoader();
    setListOpen(true);
  }, 400);
}
