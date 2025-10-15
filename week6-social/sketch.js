/*
  Single-page network visualization: nodes (bubbles) + connections
  - Hover, drag, tap interactions affect node size, color, and edge strength
  - Algorithmic emergent "bullying" patterns: dominance (red/expand), exclusion (fade/detach), cluster formation
  - Preserves replicate proxy variable and Firebase helper placeholders for compatibility
*/

// kept from original project for potential asset requests
const replicateProxy = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";

// Firebase placeholder (remove or initialize if you want to store state externally)
let db = null;

// --- Firebase auth integration (modular v10 SDK). Replace with your config.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCTMrFlfV4rXm3zcvbmC8etwT8lqVKF4dY",
  authDomain: "sharedminds-c3e82.firebaseapp.com",
  databaseURL: "https://sharedminds-c3e82-default-rtdb.firebaseio.com",
  projectId: "sharedminds-c3e82",
  storageBucket: "sharedminds-c3e82.firebasestorage.app",
  messagingSenderId: "349004784117",
  appId: "1:349004784117:web:e4bdaa9070ae812eda80bc",
  measurementId: "G-96S61SSPNV"
};
let localUser = null; // { uid, name }
let auth = null;
function initFirebase(){
  try{
    initializeApp(firebaseConfig);
    auth = getAuth();
    const signInBtn = document.getElementById('signInBtn');
    const signOutBtn = document.getElementById('signOutBtn');
    const userLabel = document.getElementById('userLabel');
    const modal = document.getElementById('signInModal');
    const modalSignInBtn = document.getElementById('modalSignInBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    signInBtn && signInBtn.addEventListener('click', ()=>{ if(modal) modal.style.display = 'flex'; });
    signOutBtn && signOutBtn.addEventListener('click', ()=>{ signOut(auth).catch(e=>console.warn(e)); });
  // Google sign-in and display-name removed; names will be randomly assigned
  const modalEmail = document.getElementById('modalEmail');
  const modalPassword = document.getElementById('modalPassword');
  const modalEmailSignUpBtn = document.getElementById('modalEmailSignUpBtn');
  const modalEmailSignInBtn = document.getElementById('modalEmailSignInBtn');
  const modalErrorEl = document.getElementById('modalError');
    
  // shorter alias references (modalName removed)
  const modalName = null;
    

    function showModalError(msg){ if(modalErrorEl){ modalErrorEl.style.display='block'; modalErrorEl.textContent = msg; } }

  // no programmatic autofill hints here (inputs are configured in HTML)

    // Google sign-in removed per request; only email/password flows are available

    modalEmailSignUpBtn && modalEmailSignUpBtn.addEventListener('click', ()=>{
      const email = modalEmail ? modalEmail.value.trim() : '';
      const password = modalPassword ? modalPassword.value : '';
      if(!email || !password){ showModalError('Provide email and password to sign up'); return; }
      // create account and assign a random name on auth state change
      import('https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js').then(mod => {
        const { createUserWithEmailAndPassword } = mod;
        createUserWithEmailAndPassword(auth, email, password)
          .then(userCred => { if(modal) modal.style.display = 'none'; })
          .catch(err => { console.warn('sign up failed', err); showModalError(err.message || String(err)); });
      });
    });

    modalEmailSignInBtn && modalEmailSignInBtn.addEventListener('click', ()=>{
      const email = modalEmail ? modalEmail.value.trim() : '';
      const password = modalPassword ? modalPassword.value : '';
      if(!email || !password){ showModalError('Provide email and password to sign in'); return; }
      import('https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js').then(mod => {
        const { signInWithEmailAndPassword } = mod;
        signInWithEmailAndPassword(auth, email, password)
    .then(userCred => { console.log('signed in email', userCred.user); if(modal) modal.style.display = 'none'; })
          .catch(err => { console.warn('email sign-in failed', err); showModalError(err.message || String(err)); });
      });
    });
    modalCloseBtn && modalCloseBtn.addEventListener('click', ()=>{ if(modal) modal.style.display = 'none'; });
    // when modal is opened, do nothing special (no prefill)
    onAuthStateChanged(auth, (u) => {
      if(u){
        // always assign a random name regardless of displayName
        const name = assignRandomName();
        localUser = { uid: u.uid, name };
        signInBtn && (signInBtn.style.display = 'none');
        signOutBtn && (signOutBtn.style.display = 'inline-block');
        userLabel && (userLabel.textContent = name);
          // show action input when signed in
          const actionBar = document.getElementById('actionBar');
          const actionInput = document.getElementById('userActionInput');
          const actionBtn = document.getElementById('userActionSendBtn');
          const actionHint = document.getElementById('actionHint');
          if(actionBar){ actionBar.style.display = 'flex'; }
          if(actionInput){ actionInput.style.display = 'inline-block'; }
          if(actionBtn){ actionBtn.style.display = 'inline-block'; }
          if(actionHint){ actionHint.style.display = 'block'; }
          if(actionBtn && actionInput){ actionBtn.addEventListener('click', ()=>{ if(actionInput.value && actionInput.value.trim()) propagateUserAction(actionInput.value.trim()); actionInput.value = ''; }); }
        console.log('auth state changed: signed in', u.uid, u.email);
        ensureUserNode();
      } else {
        localUser = null;
        signInBtn && (signInBtn.style.display = 'inline-block');
        signOutBtn && (signOutBtn.style.display = 'none');
        userLabel && (userLabel.textContent = '');
  const modal = document.getElementById('signInModal'); if(modal) modal.style.display = 'flex';
  const actionBar = document.getElementById('actionBar'); if(actionBar) actionBar.style.display = 'none';
      }
    });
  }catch(err){ console.warn('Firebase init failed', err); }
  console.log('initFirebase() completed');
}

// name generator: curated less-common animals (unique, no numeric suffixes)
const NAME_POOL = [
  "axolotl", "pangolin", "quokka", "tuatara", "narwhal", "okapi", "ayeaye", "kakapo", "shoebill", "tarsier",
  "bilby", "quoll", "numbat", "gerenuk", "fossa", "markhor", "saiga", "goral", "ibex", "porcupine",
  "dormouse", "hartebeest", "kudu", "muntjac", "pika", "redstart", "loon", "lorikeet", "macaque", "marten",
  "peccary", "rhea", "skua", "tenrec", "uakari", "yabby", "bandicoot", "caracal", "dugong", "eland",
  "puffin", "dikdik", "tapir", "ermine", "manatee", "platypus", "oryx", "weasel", "stoat", "mynah",
  "kestrel", "gibbon", "kiwi", "civet", "binturong", "serow", "nyala", "saola", "dhole", "manedwolf"
];

function assignRandomName(){
  // prefer names that are not currently used by any node label in the scene
  const used = new Set(state.nodes.filter(n => n && n.label).map(n => n.label));
  const candidates = NAME_POOL.filter(n => !used.has(n));
  if(candidates.length > 0) return candidates[Math.floor(Math.random()*candidates.length)];
  // fallback: create a unique numbered name
  let base = NAME_POOL[Math.floor(Math.random()*NAME_POOL.length)];
  let i = 2; while(used.has(base + '-' + i)) i++; return base + '-' + i;
}

function ensureUserNode(){
  if(!localUser) return;
  // find existing user node by userId
  const existing = state.nodes.find(n => n.userId === localUser.uid);
  if(existing){
    existing.label = localUser.name;
    existing.pinned = true;
    // ensure uniform linkage: connect (or reset) edge strength between this node and every other node
    // do not connect to every node; ensure at least DEFAULT_NEIGHBORS nearby connections
    const K = Math.max(1, Math.min(DEFAULT_NEIGHBORS, state.nodes.length - 1));
    const distances = state.nodes
      .filter(n => n.id !== existing.id)
      .map(n => ({ id: n.id, d: (n.x - existing.x) ** 2 + (n.y - existing.y) ** 2 }))
      .sort((a,b) => a.d - b.d)
      .slice(0, K)
      .map(x => x.id);
    for(const id of distances){
      const a = Math.min(existing.id, id), b = Math.max(existing.id, id);
      let found = state.edges.find(e => e.a === a && e.b === b);
      if(found){ /* leave existing strength alone to preserve scene structure */ }
      else { state.edges.push(new Edge(a, b, INITIAL_EDGE_STRENGTH * 0.8)); }
    }
    return;
  }
  // create a new pinned node near center and link it uniformly to all preexisting nodes
  const nid = state.nodes.length;
  // place new user's node exactly at the canvas center so new users start in the middle
  const n = new Node(nid, Math.round(canvas.clientWidth / 2), Math.round(canvas.clientHeight / 2));
  n.userId = localUser.uid; n.label = localUser.name; n.pinned = true;
  state.nodes.push(n);
  // connect the new user node only to its nearest K neighbors (spatially) so it doesn't globally attract everyone
  const K = Math.max(1, Math.min(DEFAULT_NEIGHBORS + 1, state.nodes.length - 1));
  const distances = state.nodes
    .filter(m => m.id !== n.id)
    .map(m => ({ id: m.id, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
    .sort((a,b) => a.d - b.d)
    .slice(0, K)
    .map(x => x.id);
  for(const id of distances){
    const a = Math.min(n.id, id), b = Math.max(n.id, id);
    let found = state.edges.find(e => e.a === a && e.b === b);
    if(found){ /* preserve existing edges */ }
    else { state.edges.push(new Edge(a, b, INITIAL_EDGE_STRENGTH * 0.8)); }
  }
  console.log('created user node', n);
}

// Canvas
const canvas = document.getElementById('networkCanvas');
const ctx = canvas.getContext('2d');
let DPR = window.devicePixelRatio || 1;

function resize() {
  DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * DPR);
  canvas.height = Math.round(rect.height * DPR);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// small helper
function lerp(a,b,t){ return a + (b - a) * t; }

class Node {
  constructor(id, x, y) {
    this.id = id;
    this.x = x; this.y = y;
    // slower initial speeds
    this.vx = (Math.random() - 0.5) * 0.3; this.vy = (Math.random() - 0.5) * 0.3;
    // use a uniform base radius so all bubbles start the same size
    this.baseRadius = BASE_RADIUS; this.radius = this.baseRadius;
    this.attention = 0; this.locked = false;
    this.color = { h: 200, s: 70, l: 60 };
    // small visual offsets applied on hover (decay over time)
    this.colorOffset = 0; // hue offset in degrees
    this.lightOffset = 0; // lightness offset
    // timestamp until which this node is considered recently-dragged/grouped
    this.dragCooldown = 0;
    this.pinned = false;
    this.pinnedUntil = 0; // timestamp until which the node remains pinned (temporary)
    // home position: where node should very slowly return after being dragged
    this.homeX = x; this.homeY = y;
    this.returningHome = false;
  // much smaller return speed so nodes drift back extremely slowly (per-ms multiplier)
  this.returnSpeed = 0.0000015;
    // timestamp used to smoothly ramp spring influence back after a pinned period
    this.releaseRampUntil = 0;
    // when the node entered a very-red state (attention > threshold)
    this.redSince = 0;
  }
}
class Edge { constructor(a,b,str=0.5){ this.a=a; this.b=b; this.strength=str; } }

const state = { nodes: [], edges: [], running:true, autoEvents:true, lastAutoTick:0, autoInterval:2200 };

const DEFAULT_NEIGHBORS = 3; // each node will be connected to this many forward neighbors (wrap-around)
const INITIAL_EDGE_STRENGTH = 0.5; // uniform starting strength for all edges
// duration over which a recently-dropped node smoothly re-integrates into springs (ms)
const RELEASE_RAMP_MS = 10000;
// uniform starting radius for all bubbles (pixels)
const BASE_RADIUS = 22;
// if a node stays in a 'very red' (high-attention) state longer than this, others will slowly repel
const RED_ALERT_MS = 8000; // ms before other nodes start to move away
// base repulsion strength (scaled by age and distance) — small so motion is slow
const RED_REPEL_BASE = 0.16;

// propagation queue: scheduled effects from user actions
const effectQueue = []; // { time: timestamp, nodeId, effect: 'shrink'|'redden'|'attach'|'flee', intensity, sourceId }

function scheduleEffect(delayMs, nodeId, effect, intensity=1, sourceId=null){
  effectQueue.push({ time: performance.now() + delayMs, nodeId, effect, intensity, sourceId });
}

async function getEmbedding(text){
  try{
    const res = await fetch(window.__replicateProxy || replicateProxy, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text })
    });
    if(!res.ok) return null;
    const j = await res.json();
    // assume the proxy returns { embedding: [..] }
    return j.embedding || null;
  }catch(e){ console.warn('embedding failed', e); return null; }
}

function cosineSimilarity(a,b){ if(!a || !b || a.length!==b.length) return 0; let s=0, na=0, nb=0; for(let i=0;i<a.length;i++){ s += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; } if(na===0||nb===0) return 0; return s / (Math.sqrt(na)*Math.sqrt(nb)); }

async function propagateUserAction(text){
  // obtain embedding for text, if available
  const textEmb = await getEmbedding(text).catch(()=>null);
  // find user's node
  if(!localUser) return;
  const userIdx = state.nodes.findIndex(n => n.userId === localUser.uid);
  if(userIdx < 0) return;
  // BFS across the undirected graph to gather hop distances
  const adj = new Map();
  for(const n of state.nodes) adj.set(n.id, []);
  for(const e of state.edges){ adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const q = [userIdx];
  const dist = {}; dist[userIdx] = 0;
  const maxHops = 4;
  while(q.length){ const cur = q.shift(); const d = dist[cur]; if(d >= maxHops) continue; for(const nb of adj.get(cur) || []){ if(dist[nb] === undefined){ dist[nb] = d + 1; q.push(nb); } } }

  // schedule effects: closer hops get stronger/earlier effects
  for(const [nid, d] of Object.entries(dist)){
    const hop = Number(d);
    // base delay/intensity
    let delay = hop * 260 + Math.random() * 120;
    let intensity = Math.max(0.2, 1 - hop * 0.18 + (Math.random()-0.5)*0.14);
    // if we have embeddings, bias intensity/delay by similarity (closer nodes react sooner/stronger)
    if(textEmb){
      const node = state.nodes.find(x => x.id === Number(nid));
      const sim = node && node.embedding ? cosineSimilarity(textEmb, node.embedding) : 0;
      // sim roughly in [-1,1] normalize to [0,1]
      const s = (sim + 1) / 2;
      // reduce delay and boost intensity for similar nodes
      delay = Math.max(30, delay * (1 - 0.55 * s));
      intensity = Math.min(1.4, intensity * (1 + 0.9 * s));
      // if similarity is high, create a temporary semantic pull and strengthen the connecting edge
      if(node && node.embedding && s > 0.38){
        const a = Math.min(userIdx, node.id), b = Math.max(userIdx, node.id);
        let found = state.edges.find(e => e.a === a && e.b === b);
        // weaken the bump to avoid rapid merging
        const bump = s * 0.22;
        if(found){ found.strength = Math.min(1, found.strength + bump); }
        else { state.edges.push(new Edge(a, b, Math.min(1, INITIAL_EDGE_STRENGTH + bump))); }
        // assign a weaker semantic pull but for a longer duration so behavior is gentle and slow
        node.semanticPull = { targetId: userIdx, strength: Math.max(0.06, s * 0.55), until: performance.now() + 14000 + Math.random() * 6000 };
      }
    }
    // pick effect types probabilistically
    // shrink: compress the bubble briefly
    scheduleEffect(delay, Number(nid), 'shrink', intensity, userIdx);
    // redden: increase attention/pressure
    scheduleEffect(delay + 120, Number(nid), 'redden', intensity * 0.9, userIdx);
    // attach or flee: dependent on random bias
    const motion = (Math.random() < 0.55) ? 'attach' : 'flee';
    scheduleEffect(delay + 220, Number(nid), motion, intensity * 0.6, userIdx);
  }
}

// propagate an action originating from an arbitrary node (simulate that bubble acting like a user)
async function propagateNodeAction(sourceNodeId, text){
  const textEmb = await getEmbedding(text).catch(()=>null);
  if(sourceNodeId == null) return;
  const userIdx = state.nodes.findIndex(n => n.id === sourceNodeId);
  if(userIdx < 0) return;
  const adj = new Map();
  for(const n of state.nodes) adj.set(n.id, []);
  for(const e of state.edges){ adj.get(e.a).push(e.b); adj.get(e.b).push(e.a); }
  const q = [userIdx];
  const dist = {}; dist[userIdx] = 0;
  const maxHops = 4;
  while(q.length){ const cur = q.shift(); const d = dist[cur]; if(d >= maxHops) continue; for(const nb of adj.get(cur) || []){ if(dist[nb] === undefined){ dist[nb] = d + 1; q.push(nb); } } }
  for(const [nid, d] of Object.entries(dist)){
    const hop = Number(d);
    let delay = hop * 260 + Math.random() * 120;
    let intensity = Math.max(0.2, 1 - hop * 0.18 + (Math.random()-0.5)*0.14);
    if(textEmb){
      const node = state.nodes.find(x => x.id === Number(nid));
      const sim = node && node.embedding ? cosineSimilarity(textEmb, node.embedding) : 0;
      const s = (sim + 1) / 2;
      delay = Math.max(30, delay * (1 - 0.55 * s));
      intensity = Math.min(1.4, intensity * (1 + 0.9 * s));
      if(node && node.embedding && s > 0.38){
        const a = Math.min(userIdx, node.id), b = Math.max(userIdx, node.id);
        let found = state.edges.find(e => e.a === a && e.b === b);
        const bump = s * 0.16; // even weaker for simulated bubbles
        if(found){ found.strength = Math.min(1, found.strength + bump); }
        else { state.edges.push(new Edge(a, b, Math.min(1, INITIAL_EDGE_STRENGTH + bump))); }
        node.semanticPull = { targetId: userIdx, strength: Math.max(0.04, s * 0.45), until: performance.now() + 16000 + Math.random() * 8000 };
      }
    }
    scheduleEffect(delay, Number(nid), 'shrink', intensity, userIdx);
    scheduleEffect(delay + 120, Number(nid), 'redden', intensity * 0.9, userIdx);
    const motion = (Math.random() < 0.55) ? 'attach' : 'flee';
    scheduleEffect(delay + 220, Number(nid), motion, intensity * 0.5, userIdx);
  }
}

// executor: apply due effects each frame (called from step loop indirectly via effectQueue)
function processEffectQueue(){
  const now = performance.now();
  for(let i = effectQueue.length - 1; i >= 0; i--){
    const ev = effectQueue[i];
    if(ev.time <= now){
      const n = state.nodes.find(x => x.id === ev.nodeId);
      if(n){
        if(ev.effect === 'shrink'){
          // temporarily reduce radius and add subtle negative light offset
          n.radius = Math.max(6, n.radius * (1 - 0.08 * ev.intensity));
          n.attention = Math.min(1, n.attention + 0.06 * ev.intensity);
          n.lightOffset -= 2 * ev.intensity;
        } else if(ev.effect === 'redden'){
          // more subtle redden
          n.attention = Math.min(1, n.attention + 0.14 * ev.intensity);
          n.colorOffset += 3 * ev.intensity;
          n.lightOffset -= 2 * ev.intensity;
        } else if(ev.effect === 'attach'){
          // pull node very gently toward the source (user) — much smaller impulse
          const src = state.nodes.find(x => x.userId === (localUser && localUser.uid)) || state.nodes[ev.sourceId];
          if(src){ const dx = src.x - n.x, dy = src.y - n.y, d = Math.max(1, Math.sqrt(dx*dx+dy*dy)); n.vx += (dx/d) * 0.28 * ev.intensity; n.vy += (dy/d) * 0.28 * ev.intensity; }
        } else if(ev.effect === 'flee'){
          const src = state.nodes.find(x => x.userId === (localUser && localUser.uid)) || state.nodes[ev.sourceId];
          if(src){ const dx = n.x - src.x, dy = n.y - src.y, d = Math.max(1, Math.sqrt(dx*dx+dy*dy)); n.vx += (dx/d) * 0.24 * ev.intensity; n.vy += (dy/d) * 0.24 * ev.intensity; }
        }
      }
      effectQueue.splice(i,1);
    }
  }
}

function createNetwork(n=18){
  state.nodes = []; state.edges = [];
  const w = canvas.clientWidth, h = canvas.clientHeight;
  // create 3 distant clusters so the scene starts with separate patches of bubbles
  const clusterCount = 3;
  const baseCounts = new Array(clusterCount).fill(Math.floor(n / clusterCount));
  for(let i=0;i<n % clusterCount;i++) baseCounts[i]++;
  // choose cluster centers spread across the canvas (left, right, bottom-center)
  const centers = [
    { x: Math.max(80, w * 0.18), y: Math.max(80, h * 0.4) },
    { x: Math.max(80, w * 0.82), y: Math.max(80, h * 0.4) },
    { x: Math.max(80, w * 0.5), y: Math.max(120, h * 0.82) }
  ];
  let idx = 0;
  for(let ci = 0; ci < clusterCount; ci++){
    const count = baseCounts[ci];
    const cx = centers[ci].x, cy = centers[ci].y;
    const clusterRadius = Math.min(90, Math.max(48, Math.min(w,h) * 0.12));
    for(let j = 0; j < count; j++){
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * clusterRadius * 0.85;
      const x = Math.max(12, Math.min(w-12, cx + Math.cos(angle) * r));
      const y = Math.max(12, Math.min(h-12, cy + Math.sin(angle) * r));
      state.nodes.push(new Node(idx, x, y));
      idx++;
    }
  }
  // Connect each node to its K nearest neighbors (spatially) so clusters are locally connected
  const K = Math.min(DEFAULT_NEIGHBORS, n - 1);
  for(let i = 0; i < n; i++){
    const distances = [];
    for(let j = 0; j < n; j++){
      if(i === j) continue;
      const dx = state.nodes[j].x - state.nodes[i].x, dy = state.nodes[j].y - state.nodes[i].y;
      distances.push({ id: j, d: dx*dx + dy*dy });
    }
    distances.sort((a,b) => a.d - b.d);
    for(let k = 0; k < Math.min(K, distances.length); k++){
      const j = distances[k].id;
      const a = Math.min(i, j), b = Math.max(i, j);
      if(!state.edges.find(e => e.a === a && e.b === b)) state.edges.push(new Edge(a, b, INITIAL_EDGE_STRENGTH));
    }
  }
  // re-add user node if user already signed in
  if(localUser) ensureUserNode();
  // asynchronously fetch embeddings for node labels (if proxy available)
  for(const node of state.nodes){
    if(!node.embedding){
      getEmbedding(node.label || String(node.id)).then(vec => { if(vec) node.embedding = vec; }).catch(()=>{});
    }
  }
}
createNetwork(20);

// UI bindings
const resetBtn = document.getElementById('resetBtn');
const toggleSimBtn = document.getElementById('toggleSimBtn');
const autoCheckbox = document.getElementById('autoEvents');
if(resetBtn) resetBtn.addEventListener('click', ()=>{ createNetwork(20); });
if(toggleSimBtn) toggleSimBtn.addEventListener('click', ()=>{ state.running = !state.running; toggleSimBtn.textContent = state.running ? 'Pause Simulation' : 'Resume Simulation'; });
if(autoCheckbox) autoCheckbox.addEventListener('change', (e)=>{ state.autoEvents = e.target.checked; });

// interactions
let pointer = { x:0,y:0,down:false };
let grabbed = null;
function getPointerFromEvent(e){
  // Return pointer coordinates relative to the canvas (CSS pixels)
  let clientX, clientY;
  if (e.touches && e.touches[0]) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
  else { clientX = e.clientX; clientY = e.clientY; }
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// Hit test with some padding so the cursor doesn't need to be pixel-perfect
const HIT_PADDING = 10;
function findNodeAt(x,y){
  for(let i=state.nodes.length-1;i>=0;i--){
    const n = state.nodes[i];
    const dx = x - n.x, dy = y - n.y;
    if (Math.sqrt(dx*dx + dy*dy) <= n.radius + HIT_PADDING) return i;
  }
  return null;
}

// pointer/touch interaction state for tap detection
let pointerDownTime = 0;
let pointerDownPos = { x: 0, y: 0 };
let lastHover = null;
let grabbedOriginalPos = null;

canvas.addEventListener('pointerdown', (e) => {
  const p = getPointerFromEvent(e);
  pointer.down = true; pointer.x = p.x; pointer.y = p.y;
  pointerDownTime = performance.now(); pointerDownPos = { x: p.x, y: p.y };
  grabbed = findNodeAt(p.x, p.y);
  // interactions allowed only for signed-in user and only on their own node
  if(!localUser){
    // not signed in -> do not allow grabbing or interacting
    grabbed = null;
    grabbedOriginalPos = null;
    return;
  }
  if (grabbed != null) {
    const node = state.nodes[grabbed];
    // only allow interacting with your own node
    if (node.userId !== localUser.uid) { grabbed = null; grabbedOriginalPos = null; return; }
    // allow re-grabbing a pinned node: unpin when user intentionally grabs it
    node.locked = true;
    node.pinned = false;
    // remember original position before dragging and set as home (we will return there)
    grabbedOriginalPos = { x: node.x, y: node.y };
    node.homeX = node.x; node.homeY = node.y; node.returningHome = false;
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = getPointerFromEvent(e);
  pointer.x = p.x; pointer.y = p.y;
  if (pointer.down && grabbed != null) {
    // dragging
    const n = state.nodes[grabbed];
    n.x = pointer.x; n.y = pointer.y; n.vx = 0; n.vy = 0;
  n.attention = Math.min(1, n.attention + 0.02);
    intensifyNearby(n, 0.8, 0.03);
  } else {
    // hover feedback (immediate small bump)
    const hoverIdx = findNodeAt(pointer.x, pointer.y);
    if (hoverIdx != null && localUser && state.nodes[hoverIdx].userId === localUser.uid) {
      // only allow hover interactions on your own node
      const hn = state.nodes[hoverIdx];
      hn.attention = Math.min(1, hn.attention + 0.015);
      intensifyNearby(hn, 0.7, 0.01);
      // noticing: add small random visual offsets (decay later)
      hn.colorOffset += (Math.random() * 8 - 4) * 0.6; // hue offset toward red-ish
      hn.lightOffset += (Math.random() - 0.5) * 1.6;
      lastHover = hoverIdx;
    } else {
      lastHover = null;
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  const upTime = performance.now();
  const p = getPointerFromEvent(e);
  pointer.down = false;
  // detect tap: short duration and small movement
  const dt = upTime - pointerDownTime;
  const dx = p.x - pointerDownPos.x, dy = p.y - pointerDownPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isTap = dt < 300 && dist < 12;
  if (grabbed != null) {
    const main = state.nodes[grabbed];
    // lock and pin the node at its dropped location briefly
    const now = performance.now();
    main.locked = true; main.pinned = true;
    main.vx = 0; main.vy = 0;
    main.dragCooldown = now + 1600;
    main.pinnedUntil = now + 3000;

    // select only the top few strongest-linked neighbors (2..5) to mutually shift toward each other
    const desiredK = 2 + Math.floor(Math.random() * 4); // 2..5
    const incident = state.edges.filter(e => e.a === main.id || e.b === main.id).slice();
    incident.sort((a,b) => b.strength - a.strength);
    const chosenIds = incident.slice(0, Math.min(desiredK, incident.length)).map(e => (e.a === main.id ? e.b : e.a));
    // if insufficient incident neighbors, fallback to nearest nodes (based on original grab position)
    if (chosenIds.length < desiredK && grabbedOriginalPos) {
      const need = desiredK - chosenIds.length;
      const others = state.nodes
        .map((n) => ({ id: n.id, d: Math.hypot(n.x - grabbedOriginalPos.x, n.y - grabbedOriginalPos.y) }))
        .filter(o => o.id !== main.id && !chosenIds.includes(o.id))
        .sort((a,b) => a.d - b.d)
        .slice(0, need)
        .map(o => o.id);
      chosenIds.push(...others);
    }

    // apply gentle mutual velocities: neighbors toward main, main slightly toward neighbors
    const nowR = performance.now();
    main.releaseRampUntil = Math.max(main.releaseRampUntil || 0, nowR + RELEASE_RAMP_MS);
    // accumulate influence on main from neighbors
    let accX = 0, accY = 0;
    for (let i = 0; i < chosenIds.length; i++){
      const node = state.nodes.find(n => n.id === chosenIds[i]);
      if(!node) continue;
      const dx = main.x - node.x, dy = main.y - node.y;
      const d = Math.max(1, Math.sqrt(dx*dx + dy*dy));
      // neighbor moves toward a nearby spot close to main (very gentle)
      const towardScale = 0.06 + Math.random() * 0.06;
      node.vx += (main.x - node.x) / d * towardScale;
      node.vy += (main.y - node.y) / d * towardScale;
      node.attention = Math.min(1, node.attention + 0.03);
      node.releaseRampUntil = Math.max(node.releaseRampUntil || 0, nowR + RELEASE_RAMP_MS);
      // slightly reduce the edge bump to avoid strong merging
      const a = Math.min(main.id, node.id), b = Math.max(main.id, node.id);
      let found = state.edges.find(e => e.a === a && e.b === b);
      if(found){ found.strength = Math.min(1, found.strength + 0.12); }
      else { state.edges.push(new Edge(a, b, Math.min(1, INITIAL_EDGE_STRENGTH + 0.06))); }
      // accumulate vector for main's response
      accX += (node.x - main.x) / d * towardScale;
      accY += (node.y - main.y) / d * towardScale;
    }
    // make main react gently toward neighbors (average influence)
    if(chosenIds.length > 0){
      main.vx += (accX / chosenIds.length) * 0.95;
      main.vy += (accY / chosenIds.length) * 0.95;
    }

    // do NOT set returningHome — this is not a "go home" behavior; nodes now settle naturally
    grabbed = null;
  }
  if (isTap) {
    const idx = findNodeAt(p.x, p.y);
    // allow tapping only if signed in and it's your node
    if (idx != null && localUser && state.nodes[idx].userId === localUser.uid) tapPulse(idx);
  }
});

canvas.addEventListener('pointerleave', () => { pointer.down = false; if (grabbed != null) { state.nodes[grabbed].locked = false; grabbed = null; } lastHover = null; });

function step(dt){
  const nodes = state.nodes;
  // process any scheduled user-action effects
  processEffectQueue();
  const now = performance.now();
  for(const n of nodes){
    // if node is within dragCooldown period, keep it locked and stationary
    if(n.dragCooldown && n.dragCooldown > now){
      n.locked = true;
      n.vx = 0; n.vy = 0;
    } else {
      // after cooldown, allow physics to apply (but keep pinned nodes visually fixed)
      if(n.locked && n.pinned){
        // if still within pinnedUntil, keep it fixed; otherwise allow gradual physics to resume
        if(n.pinnedUntil && n.pinnedUntil > now){ n.vx = 0; n.vy = 0; }
        else { n.locked = false; }
      }
      if(!n.locked){
        n.x += n.vx; n.y += n.vy;
        if(n.x<10){ n.x=10; n.vx*=-0.3; } if(n.y<10){ n.y=10; n.vy*=-0.3; }
        if(n.x>canvas.clientWidth-10){ n.x=canvas.clientWidth-10; n.vx*=-0.3; } if(n.y>canvas.clientHeight-10){ n.y=canvas.clientHeight-10; n.vy*=-0.3; }
      }
    }
    // semanticPull: gentle attraction to a target (based on text similarity)
    if(n.semanticPull && n.semanticPull.until && n.semanticPull.until > now){
      const target = state.nodes.find(x => x.id === n.semanticPull.targetId);
      if(target){ const dx = target.x - n.x, dy = target.y - n.y; const d = Math.max(1, Math.sqrt(dx*dx+dy*dy)); const strength = n.semanticPull.strength * 0.75; n.vx += (dx/d) * 0.12 * strength; n.vy += (dy/d) * 0.12 * strength; }
    } else if(n.semanticPull){
      // expired
      delete n.semanticPull;
    }
    // track sustained-red state
    if(n.attention > 0.88){ if(!n.redSince) n.redSince = now; }
    else { n.redSince = 0; }
    // gentle return-to-home after dragging: extremely slow restorative force
    if(n.returningHome && n.homeX !== undefined && (!n.locked)){
      // pick a subtle target: prefer the strongest-linked neighbor if link is reasonably strong
      let targetX = n.homeX, targetY = n.homeY;
      const incident = state.edges.filter(e => e.a === n.id || e.b === n.id);
      if(incident.length > 0){
        // find strongest incident edge
        const strongest = incident.reduce((best, e) => (e.strength > (best?.strength||0) ? e : best), null);
        if(strongest && strongest.strength > 0.46){ // threshold to consider neighbor meaningful
          const nid = (strongest.a === n.id ? strongest.b : strongest.a);
          const neighbor = state.nodes.find(x => x.id === nid);
          if(neighbor){ targetX = neighbor.x; targetY = neighbor.y; }
        }
      }
      const dxh = targetX - n.x, dyh = targetY - n.y;
      const dist = Math.sqrt(dxh*dxh + dyh*dyh) || 1;
  // extremely tiny restorative acceleration so nodes drift back extremely slowly
  const tinyFactor = n.returnSpeed * 0.08; // even smaller than returnSpeed
      // apply acceleration gently; scaled by dt so larger frames don't jump
      n.vx += (dxh / dist) * (dist * tinyFactor * dt);
      n.vy += (dyh / dist) * (dist * tinyFactor * dt);
      // if extremely close, stop returning to avoid tiny oscillation
  if(dist < 0.2) { n.returningHome = false; }
    }
  // very slow attention decay so size decreases slowly when no attention is given
  n.attention = Math.max(0, n.attention - 0.0004 * dt);
  // radius target scales with attention (more attention = bigger)
  const targetRadius = n.baseRadius * (1 + n.attention * 1.6);
  // very slow interpolation back to base size when attention decays
  n.radius += (targetRadius - n.radius) * 0.01;
  }

  // compute sustained-red nodes (those that have been very red for longer than RED_ALERT_MS)
  const redNodes = nodes.filter(x => x.redSince && (now - x.redSince) > RED_ALERT_MS);
  if(redNodes.length > 0){
    // apply gentle repulsive force from each red node to every other unlocked node
    for(const red of redNodes){
      const ageFactor = Math.min(1.0, (now - red.redSince) / (RED_ALERT_MS * 2));
      for(const other of nodes){
        if(other.id === red.id) continue;
        if(other.locked) continue; // don't push locked nodes
        const dx = other.x - red.x, dy = other.y - red.y;
        let d = Math.sqrt(dx*dx + dy*dy) || 0.0001;
        // gentle slow repulsion that scales with ageFactor and inverse distance
        const repel = RED_REPEL_BASE * ageFactor * (1 / Math.pow(d, 1.05));
        // scale by dt so effect is gradual
        other.vx += (dx / d) * repel * (dt * 0.002);
        other.vy += (dy / d) * repel * (dt * 0.002);
        // slightly decrease attention on pushed nodes so red influence dissipates
        other.attention = Math.max(0, other.attention - 0.0008 * dt * ageFactor);
      }
    }
  }

  // weaker spring forces and stronger damping for slower motion
  for(const e of state.edges){ const A = nodes[e.a], B = nodes[e.b]; const dx=B.x-A.x, dy=B.y-A.y; const dist=Math.max(1, Math.sqrt(dx*dx+dy*dy)); const desired = 60 + (1-e.strength)*120; const diff=(dist-desired)*0.0008*e.strength; const fx=dx/dist*diff, fy=dy/dist*diff; if(!A.locked){ A.vx += fx; A.vy += fy; } if(!B.locked){ B.vx -= fx; B.vy -= fy; } // higher damping to remove speed
  // apply stronger damping if node was recently dragged (slower fallback)
  const now2 = performance.now();
  const wasDraggedA = (A.dragCooldown && A.dragCooldown > now2);
  const wasDraggedB = (B.dragCooldown && B.dragCooldown > now2);
  // compute ramped spring influence based on pinnedUntil and releaseRampUntil to avoid snapping
  const rampA = (A.releaseRampUntil && A.releaseRampUntil > now2) ? Math.max(0.12, 1 - (A.releaseRampUntil - now2) / RELEASE_RAMP_MS) : 1.0;
  const rampB = (B.releaseRampUntil && B.releaseRampUntil > now2) ? Math.max(0.12, 1 - (B.releaseRampUntil - now2) / RELEASE_RAMP_MS) : 1.0;
  const pinEffectA = (A.pinnedUntil && A.pinnedUntil > now2) ? Math.max(0.12, (A.pinnedUntil - now2) / 3000) * rampA : rampA;
  const pinEffectB = (B.pinnedUntil && B.pinnedUntil > now2) ? Math.max(0.12, (B.pinnedUntil - now2) / 3000) * rampB : rampB;
  const factorA = wasDraggedA ? 0.08 * pinEffectA : pinEffectA;
  const factorB = wasDraggedB ? 0.08 * pinEffectB : pinEffectB;
  if(!A.locked){ A.vx += fx * factorA; A.vy += fy * factorA; }
  if(!B.locked){ B.vx -= fx * factorB; B.vy -= fy * factorB; }
  // damping tuned with pinned effect
  const dampA = wasDraggedA ? 0.992 : (0.96 + (1 - pinEffectA) * 0.02);
  const dampB = wasDraggedB ? 0.992 : (0.96 + (1 - pinEffectB) * 0.02);
  A.vx *= dampA; A.vy *= dampA; B.vx *= dampB; B.vy *= dampB;
  }

  // avoid overlap
  for(let i=0;i<nodes.length;i++){
    for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i], b=nodes[j];
      const dx=b.x-a.x, dy=b.y-a.y;
      let dist=Math.sqrt(dx*dx+dy*dy)||0.001;
      const minDist=a.radius+b.radius+6;
      if(dist<minDist){
        // overlap correction; reduce effect if either node was recently dragged so dropped nodes stay put
        const now = performance.now();
        const aFactor = (a.dragCooldown && a.dragCooldown > now) ? 0.12 : 1.0;
        const bFactor = (b.dragCooldown && b.dragCooldown > now) ? 0.12 : 1.0;
        const overlap=(minDist-dist)*0.008;
        const nx=dx/dist, ny=dy/dist;
        if(!a.locked){ a.vx -= nx*overlap*aFactor; a.vy -= ny*overlap*aFactor; }
        if(!b.locked){ b.vx += nx*overlap*bFactor; b.vy += ny*overlap*bFactor; }
      }
    }
  }

  // update colors: lerp hue from blue -> red based on attention, apply offsets and decay offsets
  for(const n of nodes){
  // base hue: blue (220) -> red (8) -- subtle at low attention, but force red when attention is very high
  let baseHue;
  if(n.attention > 0.88){ baseHue = 8; } else { const hueT = Math.min(1, n.attention * 0.9); baseHue = lerp(220, 8, hueT); }
    n.color.h = baseHue + (n.colorOffset || 0);
    // base lightness lerp 60 -> 45
    n.color.l = Math.max(18, Math.min(80, lerp(60, 45, n.attention * 0.6) + (n.lightOffset || 0)));
    // decay offsets (slower so color changes linger longer) but keep offsets small for subtlety
    n.colorOffset *= 0.985;
    n.lightOffset *= 0.97;
  }
  // slower random drift in strengths
  for(const e of state.edges){ e.strength += (Math.random()-0.5)*0.0004*dt; e.strength = Math.max(0, Math.min(1, e.strength)); }
}

function intensifyNearby(node, radiusFactor=1.0, amount=0.06){ for(const other of state.nodes){ const dx=other.x-node.x, dy=other.y-node.y; const d=Math.sqrt(dx*dx+dy*dy); if(d < 150*radiusFactor){ other.attention = Math.min(1, other.attention + amount*(1 - d/(150*radiusFactor))); } } for(const e of state.edges){ if(e.a === node.id || e.b === node.id) e.strength = Math.min(1, e.strength + 0.02); } }

// interaction tuning (kept for reference)
const interactionConfig = { radius: 30, maxAttentionChange: 0.04 };

// Tap pulse: short, visible response on tap
function tapPulse(idx) {
  const n = state.nodes[idx];
  n.attention = Math.min(1, n.attention + 0.12);
  // intensify connected edges and neighbors briefly
  for (const e of state.edges) {
    if (e.a === idx || e.b === idx) e.strength = Math.min(1, e.strength + 0.08);
  }
  intensifyNearby(n, 1.2, 0.12);
}

function autoEvent(){
  // pick a random node to act on
  if(state.nodes.length === 0) return;
  const idx = Math.floor(Math.random() * state.nodes.length);
  const n = state.nodes[idx];

  // avoid repeatedly targeting the signed-in user's bubble most of the time
  if(localUser && n.userId === localUser.uid && Math.random() > 0.18) return;

  const mode = Math.random();
  // small chance this node emits a semantic action like a user input
  if(mode < 0.14){
    // simulate an action originating from this node (use label or short random token)
    const text = n.label || ('signal-' + Math.floor(Math.random() * 9999));
    propagateNodeAction(n.id, text).catch(()=>{});
    return;
  } else if(mode < 0.45){
    // hover-like: raise attention, apply gentle color offsets, and strengthen nearby edges
  n.attention = Math.min(1, n.attention + 0.22 + Math.random() * 0.18);
    intensifyNearby(n, 1.1, 0.06);
    n.colorOffset += (Math.random() * 18 - 9);
    n.lightOffset += (Math.random() - 0.5) * 4;
    // small local edge bump
    for(const e of state.edges){ if(e.a === idx || e.b === idx) e.strength = Math.min(1, e.strength + 0.08 * Math.random()); }

  } else if (mode < 0.82){
    // tap-like: visible pulse + small physical impulse
    tapPulse(idx);
    n.vx += (Math.random() - 0.5) * 2.2;
    n.vy += (Math.random() - 0.5) * 2.2;
    // slightly increase incident edges
    for(const e of state.edges){ if(e.a === idx || e.b === idx) e.strength = Math.min(1, e.strength + 0.12 * Math.random()); }

  } else {
    // drag-like: reposition node (simulate drop) and pull a small group toward it
    const targetX = canvas.clientWidth * 0.15 + Math.random() * canvas.clientWidth * 0.7;
    const targetY = canvas.clientHeight * 0.15 + Math.random() * canvas.clientHeight * 0.7;
    n.x = targetX + (Math.random() - 0.5) * 48;
    n.y = targetY + (Math.random() - 0.5) * 48;
    n.vx = 0; n.vy = 0;
    n.attention = Math.min(1, n.attention + 0.2 + Math.random()*0.14);
    n.dragCooldown = performance.now() + 2400;
    // set a release ramp to avoid snapping back; mark current time window
    const nowR = performance.now();
    n.releaseRampUntil = Math.max(n.releaseRampUntil || 0, nowR + RELEASE_RAMP_MS);

    // pull only the top few strongest-linked neighbors (2..5) toward the dropped node
    const desiredK = 2 + Math.floor(Math.random() * 4); // 2..5
    // gather incident edges to the dropped node and pick strongest
    const incident = state.edges.filter(e => e.a === n.id || e.b === n.id).slice();
    incident.sort((a,b) => b.strength - a.strength);
    const chosenIds = incident.slice(0, Math.min(desiredK, incident.length)).map(e => (e.a === n.id ? e.b : e.a));
    // if not enough incident neighbors, fill by nearest nodes within 160px
    if (chosenIds.length < desiredK) {
      const need = desiredK - chosenIds.length;
      const others = state.nodes
        .map((m) => ({ id: m.id, d: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter(o => o.id !== n.id && !chosenIds.includes(o.id))
        .sort((a,b) => a.d - b.d)
        .slice(0, need)
        .map(o => o.id);
      chosenIds.push(...others);
    }
    for (let i = 0; i < Math.min(chosenIds.length, desiredK); i++){
      const node = state.nodes.find(m => m.id === chosenIds[i]);
      if(!node) continue;
      const angle = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 64;
      const targetX2 = n.x + Math.cos(angle) * r;
      const targetY2 = n.y + Math.sin(angle) * r;
  // very gentle velocity towards target to avoid teleporting or strong grouping
  const dx = targetX2 - node.x, dy = targetY2 - node.y; const d = Math.max(1, Math.sqrt(dx*dx + dy*dy));
  node.vx = (dx / d) * (0.04 + Math.random() * 0.06);
  node.vy = (dy / d) * (0.04 + Math.random() * 0.06);
      node.attention = Math.min(1, node.attention + 0.04);
      node.releaseRampUntil = Math.max(node.releaseRampUntil || 0, nowR + RELEASE_RAMP_MS);
      // strengthen or create edge between n and this node
      const a = Math.min(n.id, node.id), b = Math.max(n.id, node.id);
      let found = state.edges.find(e => e.a === a && e.b === b);
  if(found){ found.strength = Math.min(1, found.strength + 0.12); }
  else { state.edges.push(new Edge(a, b, Math.min(1, INITIAL_EDGE_STRENGTH + 0.06))); }
    }
  }

  // gentle drift on incident edges
  for(const e of state.edges){ if(e.a === idx || e.b === idx) e.strength = Math.min(1, e.strength + (Math.random() - 0.5) * 0.12); }

  // occasional exclusion behavior (as before)
  const neighbors = state.edges.filter(e => e.a === idx || e.b === idx).map(e => (e.a === idx ? e.b : e.a));
  if(neighbors.length > 1 && Math.random() < 0.28){
    const excluded = neighbors[Math.floor(Math.random() * neighbors.length)];
    for(const e of state.edges){ if((e.a === excluded && neighbors.includes(e.b)) || (e.b === excluded && neighbors.includes(e.a))){ e.strength = Math.max(0, e.strength - 0.35 * Math.random()); } }
    state.nodes[excluded].attention = Math.max(0, state.nodes[excluded].attention - 0.5);
    state.nodes[excluded].color.h = 200; state.nodes[excluded].color.l = 80;
  }
}

function render(){ const w = canvas.clientWidth, h = canvas.clientHeight; ctx.clearRect(0,0,w,h);
  // draw edges with thickness based on node distance (closer => thicker)
  for(const e of state.edges){
    const A = state.nodes[e.a], B = state.nodes[e.b];
    const dx = B.x - A.x, dy = B.y - A.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const minDist = 20, maxDist = 220;
    const closeness = Math.max(0, Math.min(1, 1 - (dist - minDist) / (maxDist - minDist)));
    const width = 0.6 + e.strength * 5 * closeness; // closer => thicker
    const alpha = 0.06 + e.strength * 0.9 * closeness; // closer => more opaque
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    ctx.lineWidth = Math.max(0.4, width);
    // solid black with varying transparency
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.stroke();
  }

  for(const n of state.nodes){ ctx.beginPath(); ctx.arc(n.x,n.y,n.radius,0,Math.PI*2); const hval = Math.round(n.color.h); const sval = Math.round(n.color.s); const lval = Math.round(n.color.l); ctx.fillStyle = `hsl(${hval} ${sval}% ${lval}%)`; ctx.globalAlpha = 0.95; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = `rgba(0,0,0,${0.08 + n.attention*0.35})`; ctx.stroke(); if(n.attention > 0.85){ ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+6,0,Math.PI*2); ctx.lineWidth = 2 + n.attention*6; ctx.strokeStyle = `rgba(200,20,20,${0.12 + (n.attention-0.85)*2})`; ctx.stroke(); } }
  const nowMs = performance.now();
  for(const n of state.nodes){
    ctx.beginPath(); ctx.arc(n.x,n.y,n.radius,0,Math.PI*2);
    const hval = Math.round(n.color.h); const sval = Math.round(n.color.s); const lval = Math.round(n.color.l);
    ctx.fillStyle = `hsl(${hval} ${sval}% ${lval}%)`;
    ctx.globalAlpha = 0.95; ctx.fill(); ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + n.attention*0.35})`; ctx.stroke();
    if(n.attention > 0.85){ ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+6,0,Math.PI*2); ctx.lineWidth = 2 + n.attention*6; ctx.strokeStyle = `rgba(200,20,20,${0.12 + (n.attention-0.85)*2})`; ctx.stroke(); }

    // highlight ring for the signed-in user's bubble
    if(localUser && n.userId && n.userId === localUser.uid){
      const t = nowMs / 1000;
      const pulse = 0.45 + 0.25 * Math.abs(Math.sin(t * 3.0));
      ctx.beginPath(); ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
      ctx.lineWidth = 3 + Math.round(2 * pulse);
      ctx.strokeStyle = `rgba(0,0,0,${0.28 + pulse * 0.5})`;
      ctx.stroke();
    }

    // draw label if available (always black for readability)
    if(n.label){ ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.font = `${Math.max(10, Math.floor(n.radius * 0.6))}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.label, n.x, n.y); }
  }
  ctx.globalAlpha = 1; const hoverIdx = findNodeAt(pointer.x, pointer.y); if(hoverIdx!=null){ const n = state.nodes[hoverIdx]; ctx.beginPath(); ctx.arc(n.x,n.y,n.radius+3,0,Math.PI*2); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.stroke(); } }

let last = performance.now(); function loop(t){ const dt = Math.min(60, t-last); last = t; if(state.running){ step(dt); if(state.autoEvents && t - state.lastAutoTick > state.autoInterval){ state.lastAutoTick = t; if(Math.random() < 0.9) autoEvent(); } } render(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

setInterval(()=>{ const hoverIdx = findNodeAt(pointer.x, pointer.y); if(hoverIdx!=null && !pointer.down){ state.nodes[hoverIdx].attention = Math.min(1, state.nodes[hoverIdx].attention + 0.04); intensifyNearby(state.nodes[hoverIdx], 1.0, 0.02); } if(Math.random() < 0.012){ const e = state.edges[Math.floor(Math.random()*state.edges.length)]; if(e) e.strength = Math.max(0, Math.min(1, e.strength + (Math.random()-0.5)*0.3)); } }, 120);
// restrict periodic hover effects: only apply to signed-in user's node
setInterval(()=>{
  if(!localUser) return;
  // find the user's node
  const userIdx = state.nodes.findIndex(n => n.userId === (localUser && localUser.uid));
  if(userIdx >= 0 && !pointer.down){ state.nodes[userIdx].attention = Math.min(1, state.nodes[userIdx].attention + 0.02); intensifyNearby(state.nodes[userIdx], 1.0, 0.01); }
  if(Math.random() < 0.012){ const e = state.edges[Math.floor(Math.random()*state.edges.length)]; if(e) e.strength = Math.max(0, Math.min(1, e.strength + (Math.random()-0.5)*0.3)); }
}, 220);

window.__networkState = state; window.__createNetwork = createNetwork; window.__replicateProxy = replicateProxy;

// initialize firebase auth UI (no-op if no config / firebase libs)
window.addEventListener('load', ()=>{ initFirebase(); });