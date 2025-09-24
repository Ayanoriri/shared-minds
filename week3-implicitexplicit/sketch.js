/* Client-only image AI-detector sketch
   - Upload image
   - Ask proxy (ChatGPT-style) to answer only 'yes' or 'no' whether image is AI-generated
   - If 'yes', call image-to-image model (via same proxy) to generate a photorealistic reconstruction
   - Display original and reconstruction side-by-side
*/

let inputLocationX = window.innerWidth / 2;
let inputLocationY = window.innerHeight / 2;
let inputBoxDirectionX = 1; // kept for potential future animation

// Initialize UI after the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

let inputBoxDirectionY = 1;

let canvas;

function init() {
    initInterface();
}

// --- configuration ---
const replicateProxy = 'https://itp-ima-replicate-proxy.web.app/api/create_n_get';
const authToken = ''; // set this if your proxy requires Authorization
const img2imgModel = 'google/nano-banana'; // use google/nano-banana per request
// Mock/testing helpers — when `mockMode` is true the code will not call the network
let mockMode = false;
window.latestFileName = '';
window.latestDataUrl = null;
let selectedModel = img2imgModel;

function setStatus(msg) {
    const status = document.getElementById('status');
    if (status) status.textContent = msg || '';
}

function normalizeVerdict(text) {
    if (!text) return 'no';
    const t = String(text).trim().toLowerCase();
    if (t.startsWith('y') || t === 'yes') return 'yes';
    return 'no';
}

async function resizeImageFile(file, maxDim = 1024) {
    return await new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
            img.onload = () => {
                const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                const w = Math.round(img.width * scale);
                const h = Math.round(img.height * scale);
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = c.toDataURL('image/jpeg', 0.8);
                // robustly extract base64 regardless of mime type (strip everything before the comma)
                let base64 = dataUrl;
                if (typeof dataUrl === 'string' && dataUrl.indexOf(',') >= 0) {
                    base64 = dataUrl.split(',')[1];
                }
                resolve({ base64, dataUrl, width: w, height: h });
            };
            img.onerror = reject;
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function classifyImageBase64(base64, dataUrl) {
    // If mock mode is enabled, skip the proxy and return a deterministic local verdict
    if (mockMode) {
        setStatus('Mock mode: classifying locally');
        const name = (window.latestFileName || '').toLowerCase();
        if (name.includes('ai') || name.includes('generated') || name.includes('synth')) return 'yes';
        if (name.includes('photo') || name.includes('real') || name.includes('camera')) return 'no';
        // deterministic fallback based on base64 length parity
        return (String(base64).length % 2 === 0) ? 'yes' : 'no';
    }
    // Use a short prompt and send the image as a proper URI (data URL) in image_input.
    // Replicate expects image inputs to be URIs, not raw base64 without a data: prefix.
    const prompt = `You are a single-word classifier. Given the attached image, answer ONLY with a single word: yes if the image is AI-generated, or no if it is a real photograph. Do not add any other text, punctuation, or explanation.`;

    // ensure we have a valid URI; prefer the dataUrl (which includes the data: prefix)
    const imageUri = dataUrl || ('data:image/jpeg;base64,' + base64);

    const payload = {
        model: 'openai/gpt-4o-mini',
        input: {
            prompt: prompt,
            image_input: [imageUri],
        },
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    };

    setStatus('Classifying...');
    const resp = await fetch(replicateProxy, options);
    const json = await resp.json();
    console.log('Classification response:', json);

    // Robust parsing: the proxy may return an array like ['', 'yes'] — prefer the first element
    // that clearly normalizes to 'yes' or 'no'. Otherwise use the first non-empty entry.
    let out = '';
    if (json.output && Array.isArray(json.output) && json.output.length) {
        // Search for an item that contains a clear yes/no
        for (const item of json.output) {
            let s = '';
            if (typeof item === 'string') s = item.trim();
            else if (item && typeof item === 'object') {
                // try common shapes
                if (item.text) s = String(item.text).trim();
                else if (item.content && Array.isArray(item.content)) s = item.content.map(c => c.text || '').join('').trim();
                else s = String(item).trim();
            }
            if (!s) continue;
            const norm = normalizeVerdict(s);
            if (norm === 'yes' || norm === 'no') {
                out = s; // keep the original text
                break;
            }
            // otherwise keep first non-empty as fallback
            if (!out) out = s;
        }
    } else if (json.output_text) out = String(json.output_text).trim();
    else if (json.result) out = String(json.result).trim();
    else if (typeof json === 'string') out = json;

    console.log('Parsed classifier output:', out, '->', normalizeVerdict(out));
    return normalizeVerdict(out);
}

async function generateImageFromBase64(base64, dataUrl, width = 900, height = null, promptExtra = '') {
    // Mock generation: when mockMode is enabled, produce a local transformed image so the UI
    // can display a 'reconstruction' without calling the proxy. This version attempts to
    // look more photorealistic by applying an unsharp mask, contrast/saturation tweaks,
    // film grain, and a subtle vignette.
    if (mockMode) {
        setStatus('Mock mode: generating a subtle photorealistic variation...');
        return await new Promise((resolve) => {
            const dataUrl = window.latestDataUrl || ('data:image/jpeg;base64,' + base64);
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                // respect provided width/height; if not provided, fall back to img dims
                let w = width || img.width;
                let h = height || Math.round(img.height * (w / img.width));
                // ensure we don't upscale too large
                if (w > img.width) w = img.width;
                if (h > img.height) h = img.height;

                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const imageData = ctx.getImageData(0, 0, w, h);
                const data = imageData.data;

                // small adjustments
                const warmthR = 1.02; // slight warm tint
                const warmthB = 0.98;
                const contrast = 6; // small contrast bump
                const cFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                const saturation = 0.96; // slightly reduce saturation (real photos often less saturated than AI)
                const grainAmp = 4; // subtle film grain

                // compute center for vignette
                const cx = w / 2;
                const cy = h / 2;
                const maxDist = Math.sqrt(cx * cx + cy * cy);

                for (let i = 0; i < data.length; i += 4) {
                    let r = data[i + 0];
                    let g = data[i + 1];
                    let b = data[i + 2];

                    // apply subtle warmth
                    r = r * warmthR;
                    b = b * warmthB;

                    // contrast
                    r = cFactor * (r - 128) + 128;
                    g = cFactor * (g - 128) + 128;
                    b = cFactor * (b - 128) + 128;

                    // saturation (lerp towards gray)
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    r = gray + (r - gray) * saturation;
                    g = gray + (g - gray) * saturation;
                    b = gray + (b - gray) * saturation;

                    // film grain (subtle)
                    const grain = (Math.random() - 0.5) * grainAmp;
                    r += grain;
                    g += grain;
                    b += grain;

                    // mild vignette based on distance from center
                    const px = ((i / 4) % w);
                    const py = Math.floor((i / 4) / w);
                    const dx = px - cx;
                    const dy = py - cy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const vign = Math.max(0, 1 - (dist / maxDist));
                    const vignMix = 0.06; // how strong vignette is
                    const vignFactor = 1 - (1 - vign) * vignMix;
                    r *= vignFactor;
                    g *= vignFactor;
                    b *= vignFactor;

                    // clamp
                    data[i + 0] = Math.max(0, Math.min(255, Math.round(r)));
                    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
                    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
                    // alpha unchanged
                }

                ctx.putImageData(imageData, 0, 0);

                // tiny film-like overlay (very subtle)
                ctx.fillStyle = 'rgba(255,255,255,0.02)';
                ctx.fillRect(0, 0, w, h);

                // small label remains for debugging — hidden by default opacity 0.0 (kept for dev)
                // ctx.font = Math.max(10, Math.round(w / 30)) + 'px sans-serif';
                // ctx.fillStyle = 'rgba(255,255,255,0.85)';
                // ctx.textAlign = 'right';
                // ctx.fillText('Reconstruction (mock)', w - 8, h - 10);

                resolve(c.toDataURL('image/webp', 0.92));
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    }
    // Build the payload depending on chosen model. For flux-dev we use image_base64; for
    // the "nano-banana" example the API expects `image_input` as an array of URIs and
    // `output_format: 'jpg'`.
    const prompt = `Recreate a humanized, not ai-generated version of the provided image. ${promptExtra}`;
    let payload;
    if (selectedModel && selectedModel.toLowerCase().includes('nano')) {
        // Example shape from your message — send the dataUrl in image_input array
        payload = {
            model: selectedModel,
            input: {
                prompt: prompt,
                image_input: [dataUrl || ('data:image/jpeg;base64,' + base64)],
                output_format: 'jpg',
            },
        };
    } else {
        payload = {
            model: selectedModel || img2imgModel,
            input: {
                prompt: prompt,
                go_fast: true,
                guidance: 3.5,
                megapixels: '1',
                num_outputs: 1,
                aspect_ratio: '1:1',
                output_format: 'webp',
                output_quality: 80,
                prompt_strength: 0.8,
                num_inference_steps: 28,
                image_base64: base64,
            },
        };
    }

    setStatus('Generating reconstruction...');
    // Debug: confirm we are including the image in the payload
    try {
        console.log('Sending generation payload. model=', payload.model, ' payload.input keys=', Object.keys(payload.input), ' image_base64 length=', (base64 && base64.length) || 0);
        // also print the first 80 chars of dataUrl if present (safe preview)
        if (dataUrl) console.log('dataUrl prefix:', String(dataUrl).slice(0, 80));
    } catch (e) {
        console.log('Generation debug log failed', e);
    }
    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    };

    const resp = await fetch(replicateProxy, options);
    const json = await resp.json();
    console.log('Generation response:', json);

    // The proxy may return an array of output URLs or a single url/base64 string.
    if (json.output && Array.isArray(json.output) && json.output.length) return json.output[0];
    if (json.output && typeof json.output === 'string') return json.output;
    if (json.url) return json.url;
    // if proxy returned raw base64 without prefix
    if (json.base64) return 'data:image/webp;base64,' + json.base64;
    return null;
}

async function handleFileAnalyze(file) {
    try {
    setStatus('Preparing image...');
    const { base64, dataUrl, width, height } = await resizeImageFile(file, 1024);
    // expose for mock-mode helpers
    window.latestDataUrl = dataUrl;

    showResults({ originalDataUrl: dataUrl });

    const verdict = await classifyImageBase64(base64, dataUrl);
        document.getElementById('answer').textContent = verdict;

        if (verdict === 'yes') {
            const gen = await generateImageFromBase64(base64, dataUrl, width, height);
            if (gen) {
                let genSrc = gen;
                if (/^data:image\//.test(gen)) genSrc = gen;
                else if (/^https?:\/\//.test(gen)) genSrc = gen;
                else if (typeof gen === 'string') genSrc = 'data:image/jpeg;base64,' + gen;
                showResults({ originalDataUrl: dataUrl, generatedSrc: genSrc, genWidth: width, genHeight: height });
            } else {
                setStatus('Generation failed or returned no image.');
            }
        } else {
            setStatus('Done. Model thinks this is real.');
        }

    } catch (err) {
        console.error(err);
        setStatus('Error: ' + (err.message || err));
    }
}

function showResults({ originalDataUrl, generatedSrc } = {}) {
    const results = document.getElementById('resultArea');
    results.innerHTML = '';
    if (originalDataUrl) {
        const a = document.createElement('img');
        a.src = originalDataUrl;
        a.alt = 'Original';
        a.style.maxWidth = '48%';
        a.style.height = 'auto';
        a.style.borderRadius = '6px';
        results.appendChild(a);
    }
    if (generatedSrc) {
        const b = document.createElement('img');
        b.src = generatedSrc;
        b.alt = 'Reconstruction';
        // If gen dimensions were provided, preserve aspect ratio closely by setting width/height
        if (arguments[0] && arguments[0].genWidth) {
            const gw = arguments[0].genWidth;
            const gh = arguments[0].genHeight || 'auto';
            b.width = gw;
            if (gh !== 'auto') b.height = gh;
            b.style.maxWidth = '48%';
            b.style.height = 'auto';
        } else {
            b.style.maxWidth = '48%';
            b.style.height = 'auto';
        }
        b.style.borderRadius = '6px';
        results.appendChild(b);
    }
}

function initInterface() {
    // canvas for background/animation
    canvas = document.createElement('canvas');
    canvas.setAttribute('id', 'myCanvas');
    canvas.style.position = 'absolute';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    document.body.appendChild(canvas);

    // (removed floating typing box — left space for canvas animation or other elements)

    // top question
    const topQuestion = document.createElement('div');
    topQuestion.id = 'topQuestion';
    topQuestion.style.position = 'fixed';
    topQuestion.style.top = '8px';
    topQuestion.style.left = '50%';
    topQuestion.style.transform = 'translateX(-50%)';
    topQuestion.style.zIndex = '200';
    topQuestion.style.background = 'rgba(255,255,255,0.9)';
    topQuestion.style.padding = '8px 12px';
    topQuestion.style.borderRadius = '6px';
    topQuestion.style.fontSize = '20px';
    topQuestion.textContent = 'Is this image AI generated? ';
    const answerSpan = document.createElement('span');
    answerSpan.id = 'answer';
    answerSpan.style.fontWeight = '700';
    topQuestion.appendChild(answerSpan);
    document.body.appendChild(topQuestion);

    // upload controls
    const uploadContainer = document.createElement('div');
    uploadContainer.style.position = 'fixed';
    uploadContainer.style.top = '56px';
    uploadContainer.style.left = '50%';
    uploadContainer.style.transform = 'translateX(-50%)';
    uploadContainer.style.zIndex = '200';
    uploadContainer.style.background = 'rgba(255,255,255,0.9)';
    uploadContainer.style.padding = '10px';
    uploadContainer.style.borderRadius = '6px';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.id = 'imageInput';
    uploadContainer.appendChild(fileInput);

    const analyzeBtn = document.createElement('button');
    analyzeBtn.id = 'analyzeBtn';
    analyzeBtn.textContent = 'Analyze';
    analyzeBtn.style.marginLeft = '8px';
    uploadContainer.appendChild(analyzeBtn);

    // mock mode checkbox
    const mockLabel = document.createElement('label');
    mockLabel.style.marginLeft = '12px';
    mockLabel.style.fontSize = '13px';
    const mockCheckbox = document.createElement('input');
    mockCheckbox.type = 'checkbox';
    mockCheckbox.id = 'mockModeCheckbox';
    mockCheckbox.style.marginRight = '6px';
    mockLabel.appendChild(mockCheckbox);
    mockLabel.appendChild(document.createTextNode(' Mock mode'));
    uploadContainer.appendChild(mockLabel);

    // no model selector displayed — using internal default model

    const status = document.createElement('span');
    status.id = 'status';
    status.style.marginLeft = '8px';
    uploadContainer.appendChild(status);

    document.body.appendChild(uploadContainer);

    const resultArea = document.createElement('div');
    resultArea.id = 'resultArea';
    resultArea.style.position = 'fixed';
    resultArea.style.bottom = '12px';
    resultArea.style.left = '50%';
    resultArea.style.transform = 'translateX(-50%)';
    resultArea.style.width = '90%';
    resultArea.style.maxWidth = '1000px';
    resultArea.style.zIndex = '200';
    resultArea.style.display = 'flex';
    resultArea.style.gap = '12px';
    resultArea.style.justifyContent = 'center';
    resultArea.style.alignItems = 'center';
    document.body.appendChild(resultArea);

    analyzeBtn.addEventListener('click', () => {
        if (fileInput.files && fileInput.files[0]) {
            console.log('Analyze clicked. file=', fileInput.files[0].name, ' size=', fileInput.files[0].size);
            document.getElementById('answer').textContent = '';
            // update mockMode and latest file info
            mockMode = !!document.getElementById('mockModeCheckbox').checked;
            window.latestFileName = fileInput.files[0].name || '';
            handleFileAnalyze(fileInput.files[0]);
        } else {
            setStatus('Please choose an image first.');
        }
    });
}



