// --- CONFIGURATION ---
// 1. Proxy is now a single string, as requested.
const PROXY_URL = 'https://itp-ima-replicate-proxy.web.app/api/create_n_get';

// --- STATE ---
let edmFile = null;
let vocalFile = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Allow user to upload two songs (via HTML inputs)
    const edmInput = document.getElementById('edm-upload');
    const vocalInput = document.getElementById('vocaloid-upload');

    // Use a unified handler to keep logic clean
    if (edmInput) edmInput.addEventListener('change', e => handleFileUpload(e, 'edm'));
    if (vocalInput) vocalInput.addEventListener('change', e => handleFileUpload(e, 'vocaloid'));

    log('Ready! Upload one EDM and one Vocaloid file to start comparison.');
});

function handleFileUpload(event, type) {
    const file = event.target.files[0] || null;
    if (!file) return;

    if (type === 'edm') {
        edmFile = file;
    } else {
        vocalFile = file;
    }

    log(`Selected ${type.toUpperCase()}: "${file.name}"`);

    // Check if both files are ready
    if (edmFile && vocalFile) {
        startComparison();
    }
}

// --- MAIN LOGIC ---

async function startComparison() {
    log('Embedding files... This may take a moment.');

    try {
        // 2. Send them to the proxy and get the embedding
        const [edmEmb, vocalEmb] = await Promise.all([
            getAudioEmbedding(edmFile),
            getAudioEmbedding(vocalFile)
        ]);

        if (!Array.isArray(edmEmb) || !Array.isArray(vocalEmb)) {
            throw new Error('Embedding format unexpected from proxy.');
        }

        // 3. Calculate the cosine similarity between them and display
        const similarity = cosineSimilarity(edmEmb, vocalEmb);
        const score = Math.round(similarity * 1000) / 10; // Round to one decimal place

        log('--- COMPARISON COMPLETE ---');
        log(`EDM Song: "${edmFile.name}"`);
        log(`Vocaloid Song: "${vocalFile.name}"`);
        log(`Cosine Similarity: **${score}%**`, false, true); // Bold and center the final score

    } catch (err) {
        console.error(err);
        log(`Error: ${err.message || 'An unknown error occurred during embedding or calculation.'}`, true);
    }
}

// --- UTILITY FUNCTIONS (Simplified & Retained for Functionality) ---

/**
 * Calculates the cosine similarity between two vectors.
 * @param {number[]} a - Vector A.
 * @param {number[]} b - Vector B.
 * @returns {number} The cosine similarity score (0 to 1).
 */
function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    if (na === 0 || nb === 0) return 0;
    return dot / (na * nb);
}

/**
 * Sends audio file data to the single proxy URL to get an embedding.
 * Retains your existing complex audio processing logic (sampling, base64, ImageBind payload).
 */
async function getAudioEmbedding(file) {
    // --- START: YOUR EXISTING AUDIO PREP LOGIC (kept for function) ---
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) throw new Error('File too large');
    const sample = await getAudioSample(file);
    const b64 = await convertFileToBase64(sample);
    console.log(b64);
    const data = {
    // THIS LINE IS THE FIX: Tell the proxy where the Base64 data lives
        version: 'daanelson/imagebind:5f043aa87f515e0d7b6b9360b65785b5b289f633a43b1a08cef5989f53aed636',
        fieldToConvertBase64ToURL: 'input',
        fileFormat: 'wav',
        input: { 
            input: b64, // The Base64 data remains here
            modality: 'audio'
        }
    };
    // --- END: YOUR EXISTING AUDIO PREP LOGIC ---

    const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ` },
        body: JSON.stringify(data)
    });

    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Proxy error (${res.status}): ${txt}`);
    }

    const json = await res.json();
    if (json.error) throw new Error(json.error);

    // Check for embedding in common places
    if (json.output && json.output.embedding) return json.output.embedding;
    if (json.embedding) return json.embedding;
    if (json.audio_embedding) return json.audio_embedding;
    if (Array.isArray(json.output)) return json.output;

    throw new Error('No embedding found in response structure.');
}

/**
 * Converts a File or Blob to a Base64 string.
 */
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            console.log('FileReader result:', reader.result);
            const base64Data = reader.result.split(',')[1];
            console.log('Extracted base64 data length:', base64Data.length);
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Samples the first 30 seconds of an audio file and returns it as a WAV Blob.
 * (This function is complex but necessary for your current proxy/model setup)
 */
async function getAudioSample(file) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const ab = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab);
    console.log("Decoded AudioBuffer:", {
         length: decoded.length,
         sampleRate: decoded.sampleRate,
         channels: decoded.numberOfChannels,
         first10: decoded.numberOfChannels > 0 ? Array.from(decoded.getChannelData(0).slice(0, 10)) : null
    });

    // Start sampling at 5 seconds to avoid potential initial silence
    const offsetSeconds = 5;
    const offsetSamples = offsetSeconds * decoded.sampleRate;
    // Log original data at offset to verify it's non-zero
    const originalOffsetData = decoded.getChannelData(0).slice(offsetSamples, offsetSamples + 10);
    console.log('Original channel data from offset (first 10):', Array.from(originalOffsetData));

    const sampleLen = Math.min(decoded.length - offsetSamples, 30 * decoded.sampleRate);
    const sample = ctx.createBuffer(decoded.numberOfChannels, sampleLen, decoded.sampleRate);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const channelData = decoded.getChannelData(ch).subarray(offsetSamples, offsetSamples + sampleLen);
        sample.getChannelData(ch).set(channelData);
    }

    // Log the extracted sample's first 10 values from channel 0
    console.log('Extracted sample first 10:', Array.from(sample.getChannelData(0).slice(0, 10)));

    const wav = audioBufferToWav(sample);
    const blob = new Blob([wav], { type: 'audio/wav' });
    console.log('WAV blob created, size:', blob.size);
    return blob;
}

/**
 * Converts an AudioBuffer object into a standard WAV file ArrayBuffer.
 */
function audioBufferToWav(buffer) {
    // [Your original audioBufferToWav implementation, kept for compatibility]
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const ab = new ArrayBuffer(length);
    const view = new DataView(ab);

    function writeString(v, offset, s) { for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i)); }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * numOfChan * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numOfChan * 2, true);
    view.setUint16(32, numOfChan * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * numOfChan * 2, true);

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numOfChan; ch++) {
            const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
            offset += 2;
        }
    }
    return ab;
}

/**
 * Simple logging function to display status messages.
 */
function log(msg, isError = false, isFinalScore = false) {
    const el = document.getElementById('log');
    if (!el) return console[isError ? 'error' : 'log'](msg);
    const d = document.createElement('div');
    
    if (isFinalScore) {
        // Special styling for the final result
        d.innerHTML = msg; // Allows for bolding with innerHTML
        d.style.cssText = 'color: #1b8042; font-size: 1.2em; font-weight: bold; margin: 10px 0; text-align: center;';
    } else {
        d.textContent = `> ${msg}`;
        d.style.color = isError ? '#f44336' : '#222';
    }
    
    el.insertBefore(d, el.firstChild);
}