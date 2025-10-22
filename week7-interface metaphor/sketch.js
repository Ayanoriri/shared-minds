/*
  sketch.js

  Single-file implementation that:
  - builds a minimal UI matching the wireframe: left camera preview, right post composer
  - auto-starts the camera when the composer is visible
  - stores text comments to Firebase Realtime Database (video is not stored)

  Instructions: paste your Firebase config into the FIREBASE_CONFIG placeholder
  (an example object structure is shown). This file uses Firebase v9 modular SDK
  via CDN so you don't need a build step.
*/

(function () {
  // --- CONFIG: paste your Firebase config object here ---
  // Example structure:
  // const FIREBASE_CONFIG = {
  //   apiKey: "...",
  //   authDomain: "...",
  //   databaseURL: "https://<your-db>.firebaseio.com",
  //   projectId: "...",
  //   storageBucket: "...",
  //   messagingSenderId: "...",
  //   appId: "..."
  // };
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBoT83xK8kJxCvvp6pTo2OvRYvCZk5VzJA",
    authDomain: "thesis-125b1.firebaseapp.com",
    projectId: "thesis-125b1",
    storageBucket: "thesis-125b1.firebasestorage.app",
    messagingSenderId: "998699023689",
    appId: "1:998699023689:web:35e69d248c01818810ee98",
    measurementId: "G-BD0GBNH6FW"
  };

  // Minimal CSS to match the two-panel layout from the sketch
  const style = document.createElement('style');
  style.textContent = `
    :root{--gap:18px;--panel-bg:#fff;--board-bg:#fbfbfb}
    html,body{height:100%;margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial}
    .cp-wrap{box-sizing:border-box;padding:18px;display:flex;gap:var(--gap);height:100vh;background:#f3f3f3}
    .panel{flex:1;border-radius:8px;background:var(--panel-bg);box-shadow:0 6px 18px rgba(0,0,0,0.08);display:flex;flex-direction:column;overflow:hidden}
    .camera{display:flex;align-items:center;justify-content:center;background:#111;color:#fff;position:relative}
  video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);transform-origin:center center}
    .camera .controls{position:absolute;left:10px;top:10px;display:flex;gap:8px}
    .board{padding:18px;display:flex;flex-direction:column;gap:12px;background:var(--board-bg)}
  .composer{flex:1;display:flex;flex-direction:column;box-sizing:border-box}
  textarea{resize:none;width:100%;min-height:120px;max-height:40vh;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #ddd;font-size:16px}
    .post-row{display:flex;gap:8px;align-items:center}
    button{background:#0b76ff;color:white;border:none;padding:10px 14px;border-radius:8px;cursor:pointer}
    .posts{overflow:auto;max-height:240px;padding-right:6px;display:flex;flex-direction:column;gap:10px}
    .post{background:white;padding:10px;border-radius:6px;border:1px solid #eee}
    .note{font-size:13px;color:#666}
  `;
  document.head.appendChild(style);

  // Build DOM
  const app = document.createElement('div');
  app.className = 'cp-wrap';

  const left = document.createElement('section');
  left.className = 'panel camera';
  // controls removed: no flip button needed
  left.innerHTML = ``;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; // autoplay policies
  left.appendChild(video);

  const right = document.createElement('section');
  right.className = 'panel board';
  right.innerHTML = `
    <div class="composer">
      <textarea id="commentText" placeholder="What's happening?"></textarea>
      <div class="post-row">
        <button id="postBtn">Post</button>
        <div class="note">Camera turns on automatically while composing. Video won't be stored.</div>
      </div>
    </div>
    <div>
      <h4>Recent posts</h4>
      <div class="posts" id="posts"></div>
    </div>
  `;

  app.appendChild(left);
  app.appendChild(right);
  document.body.appendChild(app);

  // Camera handling
  let currentStream = null;
  // Start with back-facing camera when possible
  let usingFacingMode = 'environment';
  async function startCamera() {
    stopCamera();
    try {
      const constraints = {video: {facingMode: usingFacingMode}, audio: false};
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = s;
      video.srcObject = s;
    } catch (e) {
      console.warn('Camera start failed', e);
      left.innerHTML = '<div style="padding:20px;color:#333">Camera access blocked or unavailable.</div>'; 
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  // flip control removed — UI intentionally starts with preferred facingMode

  // Auto-start camera when user focuses textarea
  const textarea = document.getElementById('commentText');
  textarea.addEventListener('focus', () => {
    startCamera();
  });
  // Stop camera after leaving textarea for 10s
  let stopTimer = null;
  textarea.addEventListener('blur', () => {
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => stopCamera(), 10000);
  });

  // Firebase setup (CDN modular v9)
  let dbRef = null;
  async function initFirebase() {
    if (!FIREBASE_CONFIG) {
      console.warn('No Firebase config provided; posts will be stored locally only.');
      return;
    }
    // load firebase app + database from CDN
    await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js');
    // initialize
    const app = window.firebase.initializeApp(FIREBASE_CONFIG);
    const db = window.firebase.database(app);
    dbRef = db.ref('posts');
    // listen for posts
    dbRef.limitToLast(50).on('value', snapshot => {
      const val = snapshot.val() || {};
      renderPosts(Object.values(val).reverse());
    });
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  // Local fallback storage
  const localKey = 'cp_posts_v1';
  function saveLocalPost(post) {
    const arr = JSON.parse(localStorage.getItem(localKey) || '[]');
    arr.unshift(post);
    localStorage.setItem(localKey, JSON.stringify(arr.slice(0,200)));
    renderPosts(arr);
  }

  function renderPosts(posts) {
    const container = document.getElementById('posts');
    container.innerHTML = '';
    if (!posts || posts.length === 0) {
      container.innerHTML = '<div class="note">No posts yet</div>';
      return;
    }
    for (const p of posts) {
      const el = document.createElement('div');
      el.className = 'post';
      const time = new Date(p.t || Date.now()).toLocaleString();
      el.innerHTML = `<div style="font-size:13px;color:#666;margin-bottom:6px">${escapeHtml(p.user||'anon')} • ${time}</div><div>${escapeHtml(p.text)}</div>`;
      container.appendChild(el);
    }
  }

  function escapeHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Posting
  const postBtn = document.getElementById('postBtn');
  postBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;
    const post = {text, t: Date.now(), user: 'me'};
    if (dbRef) {
      try {
        await dbRef.push(post);
        textarea.value = '';
      } catch (e) {
        console.warn('Firebase push failed, saving locally', e);
        saveLocalPost(post);
      }
    } else {
      saveLocalPost(post);
      textarea.value = '';
    }
  });

  // load local posts to show immediately
  const local = JSON.parse(localStorage.getItem(localKey) || '[]');
  if (local.length) renderPosts(local);

  // initialize firebase listener (if config provided)
  initFirebase().catch(e=>console.warn('init firebase failed',e));

  // Clean up on pagehide
  window.addEventListener('pagehide', () => stopCamera());

  // Small polyfill UI/click helper for mobile auto-play: tap body to start camera if permissions already granted
  document.body.addEventListener('click', function once(){
    if (!currentStream) startCamera();
    document.body.removeEventListener('click', once);
  });

})();
