import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-analytics.js";
import { getDatabase, ref, push, set } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Firebase config for thesis project (as provided)
const firebaseConfig = {
  apiKey: "AIzaSyBoT83xK8kJxCvvp6pTo2OvRYvCZk5VzJA",
  authDomain: "thesis-125b1.firebaseapp.com",
  projectId: "thesis-125b1",
  storageBucket: "thesis-125b1.firebasestorage.app",
  messagingSenderId: "998699023689",
  appId: "1:998699023689:web:35e69d248c01818810ee98",
  measurementId: "G-BD0GBNH6FW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) { /* ignore analytics failures on non-https or local dev */ }
const db = getDatabase(app);

const choicesEl = document.getElementById('choices');
const statusEl = document.getElementById('status');

if (!choicesEl) throw new Error('choices element not found');

choicesEl.addEventListener('click', async (ev) => {
  const btn = ev.target.closest('button[data-choice]');
  if (!btn) return;
  const choice = btn.getAttribute('data-choice');
  if (!choice) return;
  // disable buttons to prevent duplicate submits
  Array.from(choicesEl.querySelectorAll('button')).forEach(b=>b.disabled=true);
  statusEl.textContent = 'Saving...';
  try {
    const data = { choice: parseInt(choice,10), timestamp: Date.now() };
    const refPath = 'prototype/apple_levels_responses';
    const dbRef = ref(db, refPath);
    const newKey = push(dbRef, data).key; // push then set to record
    // set is not strictly necessary because push(dbRef, data) stores automatically in v9 compat, but we mirror the pattern
    // push already wrote; we keep this for parity with week5-time style
    statusEl.textContent = 'Saved — thank you!';
  } catch (e) {
    console.error('save failed', e);
    statusEl.textContent = 'Error saving — try again';
    Array.from(choicesEl.querySelectorAll('button')).forEach(b=>b.disabled=false);
  }
});

// Expose a small debug helper
window.__prototypeSubmit = function(choice){
  const btn = document.querySelector(`button[data-choice="${choice}"]`);
  if (btn) btn.click();
};

console.log('prototype chooser initialized');
