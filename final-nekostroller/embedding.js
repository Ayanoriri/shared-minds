// ImageBind embedding integration for cat similarity matching
// Uses Replicate's ImageBind model via the same proxy as LLM

// Use the same proxy as LLM (defined in llm.js)
const IMAGEBIND_MODEL = "daanelson/imagebind:0383f62e173dc821ec52663ed22a076d9c970549c209666ac3db181618b7a304";

// Firebase configuration for web client
const firebaseConfig = {
  apiKey: "AIzaSyAwkgMLfbJioPOqK5qVo4t2SzsIZkyHlBo",
  authDomain: "neko-stroller-club.firebaseapp.com",
  databaseURL: "https://neko-stroller-club-default-rtdb.firebaseio.com",
  projectId: "neko-stroller-club",
  storageBucket: "neko-stroller-club.firebasestorage.app",
  messagingSenderId: "20624571066",
  appId: "1:20624571066:web:4473a15adf778c20b02083",
  measurementId: "G-E85VTVTHH3"
};

// Initialize Firebase (if not already initialized)
let db;
let storage;

function initializeFirebase() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
    return false;
  }
  
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  db = firebase.firestore();
  storage = firebase.storage();
  return true;
}

// Generate ImageBind embedding for a cat image
async function generateEmbedding(imageDataURL) {
  try {
    console.log('Generating embedding via proxy...');
    
    const PROXY_URL = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
    
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: IMAGEBIND_MODEL,
        input: {
          image: imageDataURL,
          modality: 'vision'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Proxy returned ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Embedding result:', result);
    
    // The proxy returns the final result directly
    if (result && result.output) {
      return result.output; // This should be the embedding vector
    } else {
      throw new Error('No embedding output received');
    }
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

// Calculate cosine similarity between two embeddings
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

// Get next cat number from Firebase (starts at 1, since 0 is default cat)
async function getNextCatNumber() {
  try {
    const counterDoc = await db.collection('metadata').doc('counter').get();
    let nextNumber = 1;
    
    if (counterDoc.exists) {
      nextNumber = (counterDoc.data().currentNumber || 0) + 1;
    }
    
    // Ensure we start from 1, not 0 (0 is reserved for default cat)
    if (nextNumber === 0) {
      nextNumber = 1;
    }
    
    await db.collection('metadata').doc('counter').set({
      currentNumber: nextNumber
    });
    
    return nextNumber;
  } catch (error) {
    console.error('Error getting next cat number:', error);
    return Math.floor(Math.random() * 10000) + 1; // Fallback to random number (not 0)
  }
}

// Save cat to Firebase with embedding
async function saveCatWithEmbedding(catNumber, imageDataURL, embedding) {
  try {
    console.log(`Saving cat #${catNumber} to Firebase...`);
    console.log('Embedding length:', embedding ? embedding.length : 'null');
    
    // Save to Firestore
    await db.collection('cats').doc(`cat_${catNumber}`).set({
      catNumber: catNumber,
      embedding: embedding,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      imageURL: imageDataURL.substring(0, 100) + '...' // Store just a preview
    });
    
    console.log(`✅ Cat #${catNumber} saved to Firestore`);
    
    // Optionally save full image to Storage
    try {
      const storageRef = storage.ref(`cats/cat_${catNumber}.png`);
      await storageRef.putString(imageDataURL, 'data_url');
      console.log(`✅ Cat #${catNumber} image saved to Storage`);
    } catch (storageError) {
      console.warn('Storage save failed (non-critical):', storageError);
    }
    
    return true;
  } catch (error) {
    console.error(`Error saving cat #${catNumber}:`, error);
    return false;
  }
}

// Find closest matching cat
async function findClosestCat(currentEmbedding) {
  try {
    const catsSnapshot = await db.collection('cats').get();
    
    let closestCat = null;
    let highestSimilarity = -1;
    
    catsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.embedding) {
        const similarity = cosineSimilarity(currentEmbedding, data.embedding);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          closestCat = data.catNumber;
        }
      }
    });
    
    return closestCat;
  } catch (error) {
    console.error('Error finding closest cat:', error);
    return null;
  }
}

// Main pipeline: Process cat after drawing
async function processCatDrawing() {
  // Initialize Firebase if not already done
  if (!db) {
    if (!initializeFirebase()) {
      console.error('Failed to initialize Firebase');
      return;
    }
  }
  
  // Get the canvas image
  const imageDataURL = window.getCatPNG ? window.getCatPNG() : null;
  if (!imageDataURL) {
    console.error('Could not get cat image');
    return;
  }
  
  // Show loading state
  updateMatchDisplay('analyzing your cat...');
  
  try {
    // Generate embedding
    const embedding = await generateEmbedding(imageDataURL);
    if (!embedding) {
      updateMatchDisplay('tell me all about your cat and i can try to draw it!');
      return;
    }
    
    // Get cat number
    const catNumber = await getNextCatNumber();
    
    // Save cat with embedding
    await saveCatWithEmbedding(catNumber, imageDataURL, embedding);
    
    // Find closest match (excluding current cat)
    const closestMatch = await findClosestCat(embedding);
    
    // Update display
    if (closestMatch && closestMatch !== catNumber) {
      updateMatchDisplay(`your closest match neko... #${closestMatch}`);
    } else {
      updateMatchDisplay(`you're neko #${catNumber} (first of its kind!)`);
    }
    
    // Store current cat number globally
    window.currentCatNumber = catNumber;
    
  } catch (error) {
    console.error('Error in cat processing pipeline:', error);
    updateMatchDisplay('tell me all about your cat and i can try to draw it!');
  }
}

// Update the match display (replaces the question text)
function updateMatchDisplay(text) {
  const label = document.querySelector('label[for="colorToggleInput"]');
  if (label) {
    label.textContent = text;
  }
}

// Reset to original state
function resetMatchDisplay() {
  updateMatchDisplay('tell me all about your cat and i can try to draw it!');
}

// Save default cat as #0 on page load
async function saveDefaultCat() {
  console.log('saveDefaultCat: Starting...');
  
  if (!db) {
    console.log('saveDefaultCat: Initializing Firebase...');
    if (!initializeFirebase()) {
      console.error('Failed to initialize Firebase for default cat');
      return;
    }
  }
  
  // Wait for canvas to be ready
  console.log('saveDefaultCat: Waiting for canvas...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    // Check if cat #0 already exists
    console.log('saveDefaultCat: Checking if cat #0 exists...');
    const cat0Doc = await db.collection('cats').doc('cat_0').get();
    if (cat0Doc.exists) {
      console.log('Default cat #0 already exists in Firebase');
      return;
    }
    
    // Get the default cat image
    console.log('saveDefaultCat: Getting cat image...');
    const imageDataURL = window.getCatPNG ? window.getCatPNG() : null;
    if (!imageDataURL) {
      console.error('Could not get default cat image - getCatPNG not available');
      return;
    }
    
    console.log('saveDefaultCat: Image captured, generating embedding...');
    const embedding = await generateEmbedding(imageDataURL);
    
    if (embedding) {
      console.log('saveDefaultCat: Embedding generated, saving to Firebase...');
      await saveCatWithEmbedding(0, imageDataURL, embedding);
      console.log('✅ Default cat #0 saved successfully!');
    } else {
      console.error('saveDefaultCat: Failed to generate embedding');
    }
  } catch (error) {
    console.error('Error saving default cat:', error);
  }
}

// Wire up the "find match" button
function wireUpFindMatchButton() {
  const findMatchBtn = document.getElementById('findMatchButton');
  if (!findMatchBtn) {
    console.warn('Find match button not found');
    return;
  }
  
  findMatchBtn.addEventListener('click', async function() {
    console.log('Find match button clicked');
    
    // Disable button during processing
    findMatchBtn.disabled = true;
    const originalText = findMatchBtn.textContent;
    findMatchBtn.textContent = 'finding...';
    
    try {
      await processCatDrawing();
    } catch (error) {
      console.error('Error in find match:', error);
      updateMatchDisplay('tell me all about your cat and i can try to draw it!');
    } finally {
      // Re-enable button
      findMatchBtn.disabled = false;
      findMatchBtn.textContent = originalText;
    }
  });
  
  console.log('Find match button wired up');
}

// Initialize Firebase early
console.log('Initializing Firebase on script load...');
initializeFirebase();

// Wire up button on page load (but don't auto-generate embeddings)
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  wireUpFindMatchButton();
} else {
  window.addEventListener('load', wireUpFindMatchButton);
}

// Expose functions globally
window.processCatDrawing = processCatDrawing;
window.resetMatchDisplay = resetMatchDisplay;
window.initializeFirebase = initializeFirebase;
window.saveDefaultCat = saveDefaultCat;

// Save default cat on page load
window.addEventListener('load', saveDefaultCat);
