// Module: drawing UI + Firebase (orbiting image viewer)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js";

// --- Firebase config (reused from week5-time) ---
const firebaseConfig = {
	apiKey: "AIzaSyCTMrFlfV4rXm3zcvbmC8etwT8lqVKF4dY",
	authDomain: "sharedminds-c3e82.firebaseapp.com",
	projectId: "sharedminds-c3e82",
	storageBucket: "sharedminds-c3e82.firebasestorage.app",
	messagingSenderId: "349004784117",
	appId: "1:349004784117:web:e4bdaa9070ae812eda80bc",
	measurementId: "G-96S61SSPNV",
	databaseURL: "https://sharedminds-c3e82-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const drawingsRef = ref(db, 'appleDrawings');

// UI elements
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
const brushSlider = document.getElementById('brush');
const clearBtn = document.getElementById('clearBtn');
const submitBtn = document.getElementById('submitBtn');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');

// drawing state (use pointer events for unified mouse/touch)
let drawing = false;
let last = null;
const colorPicker = document.getElementById('colorPicker');

function resizeCanvasDisplay(){ /* placeholder */ }

function clearCanvas(){
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0,0,canvas.width,canvas.height);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
}

clearCanvas();

function getPointerFromEvent(ev){
	const rect = canvas.getBoundingClientRect();
	// pointer event has clientX/clientY directly
	const clientX = ev.clientX !== undefined ? ev.clientX : (ev.touches && ev.touches[0] && ev.touches[0].clientX);
	const clientY = ev.clientY !== undefined ? ev.clientY : (ev.touches && ev.touches[0] && ev.touches[0].clientY);
	const x = (clientX - rect.left) * (canvas.width / rect.width);
	const y = (clientY - rect.top) * (canvas.height / rect.height);
	return {x, y};
}

function onPointerDown(ev){
	// support both PointerEvent and fallback
	ev.preventDefault();
	drawing = true;
	last = getPointerFromEvent(ev);
	// draw a dot immediately so clicks are visible
	const size = Number(brushSlider.value);
	const col = colorPicker ? colorPicker.value : '#000000';
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(last.x, last.y, Math.max(1, size/2), 0, Math.PI*2);
	ctx.fill();
	try{ if(ev.pointerId) canvas.setPointerCapture(ev.pointerId); } catch(e){}
}

function onPointerUp(ev){
	drawing = false; last = null;
	try{ if(ev.pointerId) canvas.releasePointerCapture(ev.pointerId); } catch(e){}
}

function onPointerMove(ev){
	if(!drawing) return;
	ev.preventDefault();
	const p = getPointerFromEvent(ev);
	const size = Number(brushSlider.value);
	const col = colorPicker ? colorPicker.value : '#000000';
	ctx.strokeStyle = col;
	ctx.lineWidth = size;
	ctx.beginPath();
	ctx.moveTo(last.x, last.y);
	ctx.lineTo(p.x, p.y);
	ctx.stroke();
	last = p;
}

// prefer pointer events; fallback to mouse/touch if pointer not supported
if(window.PointerEvent){
	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	window.addEventListener('pointerup', onPointerUp);
	window.addEventListener('pointercancel', onPointerUp);
} else {
	// legacy fallback
	canvas.addEventListener('mousedown', (e)=>{ onPointerDown(e); });
	canvas.addEventListener('mousemove', (e)=>{ onPointerMove(e); });
	window.addEventListener('mouseup', (e)=>{ onPointerUp(e); });
	canvas.addEventListener('touchstart', (e)=>{ onPointerDown(e); }, {passive:false});
	canvas.addEventListener('touchmove', (e)=>{ onPointerMove(e); }, {passive:false});
	window.addEventListener('touchend', (e)=>{ onPointerUp(e); });
}

clearBtn.addEventListener('click', ()=>{ clearCanvas(); });

submitBtn.addEventListener('click', async ()=>{
	const dataURL = canvas.toDataURL('image/png');
	// push minimal record: dataURL + timestamp
	try{
		await push(drawingsRef, { image: dataURL, timestamp: Date.now() });
		statusEl.textContent = 'Submitted ✓';
		setTimeout(()=>statusEl.textContent='Connected',1500);
	}catch(e){
		console.error(e); statusEl.textContent = 'Submit failed';
	}
});


// --- Orbiting image viewer (replaces Three.js) ---
const container = document.getElementById('threeContainer');
container.innerHTML = '';
container.style.position = 'relative';
container.classList.add('three-viewport');

// viewer elements: create multiple slice images at different base angles
// add 3 more slices: 135°, 180°, 270° -> total 6 slices
const sliceAngles = [0, Math.PI / 4, Math.PI / 2, 3*Math.PI/4, Math.PI, 3*Math.PI/2]; // 0°,45°,90°,135°,180°,270°
const sliceImgs = [];
sliceAngles.forEach((base, idx)=>{
	const img = document.createElement('img');
	img.className = (idx===0? 'orbit-img slice-img' : 'slice-img');
	img.alt = 'submitted apple';
	img.style.display = 'none';
	container.appendChild(img);
	sliceImgs.push({img, base});
});
const placeholder = document.createElement('div');
placeholder.className = 'placeholder';
placeholder.textContent = 'No submissions yet';
container.appendChild(placeholder);

// orbit state
let images = []; // array of dataURLs (strings)
let currentIndex = 0;
let lastSwitch = performance.now();
const switchInterval = 3000; // ms per image
let radius = 120; // px, recomputed on resize
let cx = 0, cy = 0;
const angularSpeed = 0.0006; // radians per ms

function recomputeLayout(){
	const rect = container.getBoundingClientRect();
	cx = rect.width/2;
	cy = rect.height/2;
	radius = Math.min(rect.width, rect.height) * 0.38; // keep inside container (larger images)
}
window.addEventListener('resize', recomputeLayout);
recomputeLayout();

function setImages(arr){
	images = arr || [];
	if(images.length){
		currentIndex = 0;
		// set all slice images to the current image
		sliceImgs.forEach(s => { s.img.src = images[0]; s.img.style.display = ''; });
		placeholder.style.display = 'none';
	} else {
		sliceImgs.forEach(s => { s.img.style.display = 'none'; s.img.src = ''; });
		placeholder.style.display = '';
	}
}

// (no-op)

// Convert white background pixels to transparent for display.
// threshold: 0..255 luminance above which pixels are made fully transparent
function makeTransparentDataURL(dataURL, threshold=245){
	return new Promise((resolve,reject)=>{
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = ()=>{
			const c = document.createElement('canvas');
			c.width = img.width; c.height = img.height;
			const cctx = c.getContext('2d');
			cctx.clearRect(0,0,c.width,c.height);
			cctx.drawImage(img,0,0);
			try{
				const id = cctx.getImageData(0,0,c.width,c.height);
				const d = id.data;
				for(let i=0;i<d.length;i+=4){
					const r = d[i], g = d[i+1], b = d[i+2];
					// luminance
					const lum = 0.299*r + 0.587*g + 0.114*b;
					if(lum >= threshold){
						// make pixel transparent
						d[i+3] = 0;
					}
				}
				cctx.putImageData(id,0,0);
				resolve(c.toDataURL('image/png'));
			}catch(err){
				// putImageData may fail on tainted canvas; fall back to original
				console.warn('transparent conversion failed', err);
				resolve(dataURL);
			}
		};
		img.onerror = (e)=>{ console.warn('image load failed', e); resolve(dataURL); };
		img.src = dataURL;
	});
}

// animation loop: move the single image around a circular path, and swap image periodically
function animateOrbit(now){
	requestAnimationFrame(animateOrbit);
	if(!images.length) return;
	const angle = now * angularSpeed;
	// animate each slice with its base angle offset
	const depthAmpBase = Math.max(6, radius * 0.1);
	sliceImgs.forEach(s => {
		const ang = angle + s.base;
		const depthAmp = depthAmpBase;
		const z = depthAmp * Math.sin(ang * 2);
		const foreshort = 1 - 0.25 * Math.abs(Math.sin(ang));
		const bright = 1 - 0.18 * Math.abs(Math.sin(ang));
		s.img.style.left = `50%`;
		s.img.style.top = `50%`;
		s.img.style.transform = `translate(-50%,-50%) translateZ(${Math.round(z)}px) rotateY(${ang}rad) scaleX(${foreshort.toFixed(3)})`;
		s.img.style.filter = `brightness(${bright.toFixed(3)})`;
		// set stacking so nearer elements appear on top
		s.img.style.zIndex = String(Math.round(z) + 2000);
	});
	if(now - lastSwitch > switchInterval){
		currentIndex = (currentIndex + 1) % images.length;
		sliceImgs.forEach(s => { s.img.src = images[currentIndex]; });
		lastSwitch = now;
	}
}
requestAnimationFrame(animateOrbit);

// (3D aggregation helpers removed — viewer uses raw submitted images)

// maintain latest aggregated average (no longer used for 3D)
let submissionCount = 0;

// Listen to Firebase drawings and update orbit viewer when data changes
onValue(drawingsRef, async snap => {
	const val = snap.val() || {};
	const keys = Object.keys(val);
	submissionCount = keys.length;
	countEl.textContent = String(submissionCount);
	statusEl.textContent = 'Updating…';
	// gather dataURLs (limit recent 200 to avoid overload)
	const urls = keys.slice(-200).map(k=>val[k].image).filter(Boolean);
	try{
		// convert white backgrounds to transparent for display (async)
		const conv = await Promise.all(urls.map(u=>makeTransparentDataURL(u).catch(()=>u)));
		setImages(conv);
		statusEl.textContent = 'Connected';
	}catch(e){ console.error('viewer error', e); statusEl.textContent='Error'; }
});

// initial sanity
statusEl.textContent = 'Connecting...';

