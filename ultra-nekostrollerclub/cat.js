var cols = 14;
var rows = 14;
var cell = 45; // default, will be updated in setup
var globalScale = 1; // Scale factor for fitting canvas in container

// background removed to allow transparent canvas/SVG

// global offsets (in grid cells) to reposition the whole cat
// default set to (-1, -1) so the sketch aligns with 1-based coordinates (C2 in spreadsheet terms)
let OFFSET_X = -1;
let OFFSET_Y = -1;

function setup() {
  // Create canvas at base size (14x14 grid with 45px cells = 630x630)
  cell = 45;
  const canvasWidth = cell * cols;   // 14 * 45 = 630
  const canvasHeight = cell * rows;  // 14 * 45 = 630
  
  createCanvas(canvasWidth, canvasHeight);
  
  // Calculate scale factor to fill the container
  const main = document.querySelector('main');
  if (main) {
    const containerWidth = main.clientWidth;
    const containerHeight = main.clientHeight;
    globalScale = Math.min(containerWidth / canvasWidth, containerHeight / canvasHeight);
    
    // Set canvas display size (not internal resolution)
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.style.width = (canvasWidth * globalScale) + 'px';
      canvas.style.height = (canvasHeight * globalScale) + 'px';
    }
  }
  
  if (main && canvas.parentNode !== main) {
    canvas.parentNode.removeChild(canvas);
    main.appendChild(canvas);
  }
  
  noStroke();
  drawCatDefault();
}

function draw() {
  // p5.js draw loop - only redraw when blink state changes
  // Empty draw function - we handle redraws manually via blinking timer
}

function getCurrentEyeColor() {
  // Get the eye color exactly as it would be drawn on the cat
  const defaultEyeColor = (window && window.PALETTE && window.PALETTE.green) ? window.PALETTE.green : '#838A2D';
  
  let result = defaultEyeColor;
  
  console.log("getCurrentEyeColor - PALETTE_REGION_OVERRIDES:", window.PALETTE_REGION_OVERRIDES);
  
  try {
    if (window && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES.head) {
      const headReg = window.PALETTE_REGION_OVERRIDES.head;
      console.log("getCurrentEyeColor - head overrides:", headReg);
      if (headReg.eyeL) {
        result = headReg.eyeL;
        console.log("getCurrentEyeColor - found eyeL:", headReg.eyeL);
      } else if (headReg._default) {
        result = headReg._default;
        console.log("getCurrentEyeColor - using _default:", headReg._default);
      }
    }
  } catch (e) {
    console.warn("Error getting eye color:", e);
  }
  
  console.log("getCurrentEyeColor returning:", result);
  return result;
}

// Calico cat support - randomize dots between white, orange, black
window.isCalicoCat = false;
window.calicoSeed = {};  // Store per-dot random values for consistency across redraws

function getCalicoDotColor(x, y, baseColor) {
  if (!window.isCalicoCat) return baseColor;
  
  // Skip eyes - they should use normal color logic
  if ((x === 4 && y === 4) || (x === 6 && y === 4)) {
    return baseColor;
  }
  
  // Skip chest - should stay white
  if ((x === 4 || x === 5 || x === 6) && (y >= 6 && y <= 10)) {
    return baseColor;
  }
  
  // Create a deterministic key for this dot position
  const key = `${x},${y}`;
  
  // If we haven't randomized this dot yet, do it now
  if (!window.calicoSeed[key]) {
    const calicoColors = ['white', 'orange', 'black'];
    const randomIndex = Math.floor(Math.random() * calicoColors.length);
    const selectedColorName = calicoColors[randomIndex];
    
    // Get the hex value from palette
    const hexColor = (window && window.PALETTE && window.PALETTE[selectedColorName]) 
      ? window.PALETTE[selectedColorName] 
      : selectedColorName;
    
    window.calicoSeed[key] = hexColor;
  }
  
  return window.calicoSeed[key];
}

function drawBlinkLines() {
  // Draw vertical lines over eyes when closed
  if (window.blinkState === 'closed') {
    console.log("drawBlinkLines called, blink state:", window.blinkState);
    
    const leftEyeX = (4 + OFFSET_X) * cell + cell/2;
    const leftEyeY = (4 + OFFSET_Y) * cell + cell/2;
    const rightEyeX = (6 + OFFSET_X) * cell + cell/2;
    const rightEyeY = (6 + OFFSET_Y) * cell + cell/2;
    
    // Get the current eye color - should match what's being displayed
    const eyeColor = getCurrentEyeColor();
    console.log("drawBlinkLines using eyeColor:", eyeColor);
    
    stroke(eyeColor);
    strokeWeight(2);
    
    // Left eye
    line(leftEyeX, leftEyeY - cell/4, leftEyeX, leftEyeY + cell/4);
    
    // Right eye
    line(rightEyeX, rightEyeY - cell/4, rightEyeX, rightEyeY + cell/4);
    
    noStroke();
  }
}

function windowResized() {
  // Resize based on window height
  const canvasHeight = windowHeight * 0.9; // Use 90% of viewport height for better fit
  
  // Calculate cell size from height
  cell = canvasHeight / rows;
  
  // Calculate canvas width based on cell size
  const canvasWidth = cell * cols;
  
  resizeCanvas(canvasWidth, canvasHeight);
  redrawCat();
}

// Head
const head = [
  // Face
  {x:3,y:2,c:'orange', r:'face'}, {x:3,y:3,c:'orange', r:'face'}, {x:3,y:4,c:'orange', r:'face'},
  {x:3,y:5,c:'white', r:'face'},
  {x:4,y:3,c:'black', r:'face'}, {x:4,y:5,c:'white', r:'innerface'},
  {x:5,y:3,c:'white', r:'face'}, {x:5,y:4,c:'white', r:'innerface'}, {x:5,y:5,c:'white', r:'innerface'},
  {x:6,y:3,c:'orange', r:'face'}, {x:6,y:5,c:'white', r:'innerface'},
  {x:7,y:2,c:'orange', r:'face'}, {x:7,y:3,c:'orange', r:'face'}, {x:7,y:4,c:'orange', r:'face'}, {x:7,y:5,c:'white', r:'face'},
  {x1: 3, y1: 5, x2: 4, y2: 6, c:'orange', w:8, r:'face'},
 
  // Eyes
  {x:4,y:4,c:'green', r:'eyeL'}, {x:6,y:4,c:'green', r:'eyeR'},

  // Nose & Mouth (individually tagged for patch support)
  {x1: 5, y1: 5, x2: 6, y2: 5, c:'pink', w:8, r:'nose', r2:'nose0'},
  {x1: 5, y1: 5, x2: 5.5, y2: 6, c:'pink', w:8, r:'nose', r2:'nose1'},
  {x1: 6, y1: 5, x2: 5.5, y2: 6, c:'pink', w:8, r:'nose', r2:'nose2'},
  {x1: 5, y1: 6, x2: 6, y2: 6, c:'pink', w:8, r:'nose', r2:'nose3'},

  // Ears
  {x1: 3, y1: 2, x2: 4, y2: 3, c:'black', w:8, r:'ears'},
  {x1: 8, y1: 2, x2: 7, y2: 3, c:'orange', w:8, r:'ears'}
];

// Body
const body = [
  {x:6,y:7,c:'black', r:'body'}, {x:6,y:8,c:'black', r:'body'}, {x:6,y:9,c:'white', r:'chest'},
  {x:7,y:6,c:'orange', r:'body'}, {x:7,y:7,c:'orange', r:'body'}, {x:7,y:8,c:'orange', r:'body'}, {x:7,y:9,c:'black', r:'body'}, {x:7,y:10,c:'orange', r:'body'},
  {x:8,y:6,c:'black', r:'body'}, {x:8,y:7,c:'black', r:'body'}, {x:8,y:8,c:'orange', r:'body'}, {x:8,y:9,c:'orange', r:'body'}, {x:8,y:10,c:'orange', r:'body'},
  {x:9,y:7,c:'orange', r:'body'}, {x:9,y:8,c:'orange', r:'body'}, {x:9,y:9,c:'orange', r:'body'}, {x:9,y:10,c:'orange', r:'body'},
  {x:10,y:9,c:'black', r:'body'}, {x:10,y:10,c:'orange', r:'body'},

 // Chest
  {x:4,y:6,c:'white', r:'chest'}, {x:4,y:7,c:'white', r:'chest'}, {x:4,y:8,c:'white', r:'chest'}, {x:4,y:9,c:'white', r:'chest'}, {x:4,y:10,c:'white', r:'chest'},
  {x:5,y:6,c:'white', r:'chest'}, {x:5,y:7,c:'white', r:'chest'}, {x:5,y:8,c:'white', r:'chest'}, {x:5,y:9,c:'white', r:'chest'}, {x:5,y:10,c:'white', r:'chest'},
  {x:6,y:6,c:'white', r:'chest'}, {x:6,y:10,c:'white', r:'chest'},
  {x1:6, y1:9, x2:7, y2:10, c:'orange', w:8, r:'body'},
  {x1:8, y1:6, x2:9, y2:7, c:'black', w:8, r:'body'},
  {x1:9, y1:7, x2:10, y2:8, c:'orange', w:8, r:'body'},
  {x1:10, y1:8, x2:11, y2:9, c:'black', w:8, r:'body'},
  {x1:8, y1:10, x2:9, y2:11, c:'orange', w:8, r:'body'},

  // Legs
  // Front Left leg
  {x:3,y:13,c:'white', r:'legs'}, {x:4,y:13,c:'white', r:'legs'}, {x:4,y:12,c:'white', r:'legs'}, {x:4,y:11,c:'white', r:'legs'},
  // Front Right leg
  {x:5,y:13,c:'white', r:'legs'}, {x:6,y:13,c:'white', r:'legs'}, {x:6,y:12,c:'white', r:'legs'}, {x:6,y:11,c:'white', r:'legs'},
  // Back Left leg
  {x:7,y:13,c:'white', r:'legs'}, {x:8,y:12,c:'white', r:'legs'}, {x:8,y:13,c:'white', r:'legs'}, {x:8,y:11,c:'orange', r:'legs'}, {x:9,y:11,c:'black', r:'legs'}, {x:9,y:12,c:'black', r:'legs'},
  // Back Right leg
  {x:9,y:13,c:'white', r:'legs'}, {x:10,y:13,c:'white', r:'legs'}, {x:11,y:13,c:'white', r:'legs'}, {x:10,y:12,c:'black', r:'legs'}, {x:11,y:12,c:'black', r:'legs'}, {x:10,y:11,c:'orange', r:'legs'}, {x:11,y:11,c:'orange', r:'legs'},
 
  // Nails
  {x1: 3.5, y1: 13, x2: 3, y2: 14, c:'pink', w:8, r:'nails'},
  {x1: 5.5, y1: 13, x2: 5, y2: 14, c:'pink', w:8, r:'nails'},
  {x1: 7.5, y1: 13, x2: 7, y2: 14, c:'pink', w:8, r:'nails'},
  {x1: 9.5, y1: 13, x2: 9, y2: 14, c:'pink', w:8, r:'nails'},
];

// Tail
const tail = [
  {x:12,y:10,c:'orange', r:'tail'}, {x:12,y:9,c:'orange', r:'tail'}, {x:12,y:7,c:'orange', r:'tail'}, {x:12,y:8,c:'black', r:'tail'},
  {x:11,y:6,c:'orange', r:'tail'},
  {x1:12, y1:12, x2:13, y2:11, c:'orange', w:8, r:'tail'},
  {x1:11, y1:6, x2:12, y2:7, c:'orange', w:8, r:'tail'},
];

function setup() {
  createCanvas(cols * cell, rows * cell);
  noStroke();
  drawCatDefault();
}

function dot(x, y, colorKeyOrHex, regionName, item) {
  // Resolve color by region-aware overrides and palette
  let baseCol = null;
  try {
    baseCol = (window && window.PALETTE && window.PALETTE[colorKeyOrHex]) ? window.PALETTE[colorKeyOrHex] : colorKeyOrHex;
  } catch (e) { baseCol = colorKeyOrHex; }

  let useCol = baseCol;
  try {
    if (window && window.PALETTE_REGION_OVERRIDES && regionName && window.PALETTE_REGION_OVERRIDES[regionName]) {
      const reg = window.PALETTE_REGION_OVERRIDES[regionName];
      if (item && item.r && reg[item.r]) useCol = reg[item.r];
      else if (reg[colorKeyOrHex]) useCol = reg[colorKeyOrHex];
      else if (reg._default) useCol = reg._default;
    }
    if (window && window.DOT_COLOR_OVERRIDE) useCol = window.DOT_COLOR_OVERRIDE;
  } catch (e) {}
  
  // Apply calico randomization if enabled
  if (window.isCalicoCat) {
    const calicoColor = getCalicoDotColor(x, y, useCol);
    useCol = calicoColor;
  }
  
  fill(useCol);
  // fill the whole grid cell
  circle(
    (x + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell + cell/2,
    (y + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell + cell/2,
    cell
  );
}

// ============================================================================
// TABBY CAT TEMPLATE
// ============================================================================
// Returns the complete tabby cat structure with brown body and chocolate stripes

function createTabbyCat() {
  return {
    head: [
      // Face
      {x:3,y:2,c:'brown', r:'face'}, {x:3,y:3,c:'brown', r:'face'}, {x:3,y:4,c:'brown', r:'face'},
      {x:3,y:5,c:'brown', r:'face'},
      {x:4,y:3,c:'brown', r:'face'}, {x:4,y:5,c:'brown', r:'face'},
      {x:5,y:3,c:'brown', r:'face'}, {x:5,y:4,c:'brown', r:'face'}, {x:5,y:5,c:'brown', r:'face'},
      {x:6,y:3,c:'brown', r:'face'}, {x:6,y:5,c:'brown', r:'face'},
      {x:7,y:2,c:'brown', r:'face'}, {x:7,y:3,c:'brown', r:'face'}, {x:7,y:4,c:'brown', r:'face'}, {x:7,y:5,c:'brown', r:'face'},
      {x1: 3, y1: 5, x2: 4, y2: 6, c:'brown', w:8, r:'face'},
      // Tabby stripes on face
      {x1: 5, y1: 3, x2: 5, y2: 4, c:'chocolate', w:8, r:'face'},
      {x1: 6, y1: 3, x2: 6, y2: 4, c:'chocolate', w:8, r:'face'},
      {x1: 3, y1: 4.5, x2: 4, y2: 4.5, c:'chocolate', w:8, r:'face'},
      {x1: 3, y1: 5.5, x2: 4, y2: 5.5, c:'chocolate', w:8, r:'face'},
      {x1: 7, y1: 5.5, x2: 8, y2: 5.5, c:'chocolate', w:8, r:'face'},
      {x1: 7, y1: 4.5, x2: 8, y2: 4.5, c:'chocolate', w:8, r:'face'},

      // Eyes
      {x:4,y:4,c:'green', r:'eyeL'}, {x:6,y:4,c:'green', r:'eyeR'},

      // Nose & Mouth
      {x1: 5, y1: 5, x2: 6, y2: 5, c:'black', w:8, r:'nose'},
      {x1: 5, y1: 5, x2: 5.5, y2: 6, c:'black', w:8, r:'nose'},
      {x1: 6, y1: 5, x2: 5.5, y2: 6, c:'black', w:8, r:'nose'},
      {x1: 5, y1: 6, x2: 6, y2: 6, c:'black', w:8, r:'nose'},

      // Ears (should be face color with stripes)
      {x1: 3, y1: 2, x2: 4, y2: 3, c:'chocolate', w:8, r:'face'},
      {x1: 8, y1: 2, x2: 7, y2: 3, c:'chocolate', w:8, r:'face'}
    ],
    
    body: [
      {x:6,y:7,c:'brown', r:'body'}, {x:6,y:8,c:'brown', r:'body'}, {x:6,y:9,c:'brown', r:'chest'},
      {x:7,y:6,c:'brown', r:'body'}, {x:7,y:7,c:'brown', r:'body'}, {x:7,y:8,c:'brown', r:'body'}, {x:7,y:9,c:'brown', r:'body'}, {x:7,y:10,c:'brown', r:'body'},
      {x:8,y:6,c:'brown', r:'body'}, {x:8,y:7,c:'brown', r:'body'}, {x:8,y:8,c:'brown', r:'body'}, {x:8,y:9,c:'brown', r:'body'}, {x:8,y:10,c:'brown', r:'body'},
      {x:9,y:7,c:'brown', r:'body'}, {x:9,y:8,c:'brown', r:'body'}, {x:9,y:9,c:'brown', r:'body'}, {x:9,y:10,c:'brown', r:'body'},
      {x:10,y:9,c:'brown', r:'body'}, {x:10,y:10,c:'brown', r:'body'},
      // Tabby stripes on body
      {x1: 8, y1: 6, x2: 7, y2: 7, c:'chocolate', w:8, r:'body'},
      {x1: 9, y1: 7, x2: 8, y2: 8, c:'chocolate', w:8, r:'body'},
      {x1: 8, y1: 8, x2: 7, y2: 9, c:'chocolate', w:8, r:'body'},
      {x1: 10, y1: 8, x2: 9, y2: 9, c:'chocolate', w:8, r:'body'},
      {x1: 9, y1: 10, x2: 8, y2: 11, c:'chocolate', w:8, r:'body'},
      {x1: 6, y1: 9, x2: 7, y2: 10, c:'chocolate', w:8, r:'body'},
      {x1: 8, y1: 6, x2: 9, y2: 7, c:'brown', w:8, r:'body'},
      {x1: 9, y1: 7, x2: 10, y2: 8, c:'chocolate', w:8, r:'body'},
      {x1: 10, y1: 8, x2: 11, y2: 9, c:'brown', w:8, r:'body'},

      // Chest
      {x:4,y:6,c:'brown', r:'chest'}, {x:4,y:7,c:'brown', r:'chest'}, {x:4,y:8,c:'brown', r:'chest'}, {x:4,y:9,c:'brown', r:'chest'}, {x:4,y:10,c:'brown', r:'chest'},
      {x:5,y:6,c:'brown', r:'chest'}, {x:5,y:7,c:'brown', r:'chest'}, {x:5,y:8,c:'brown', r:'chest'}, {x:5,y:9,c:'brown', r:'chest'}, {x:5,y:10,c:'brown', r:'chest'},
      {x:6,y:6,c:'brown', r:'chest'}, {x:6,y:10,c:'brown', r:'chest'},
      // Tabby stripes on chest
      {x1: 4, y1: 7.5, x2: 5, y2: 7.5, c:'chocolate', w:8, r:'chest'},
      {x1: 5, y1: 7.5, x2: 6, y2: 7.5, c:'chocolate', w:8, r:'chest'},
      {x1: 5, y1: 9.5, x2: 6, y2: 9.5, c:'chocolate', w:8, r:'chest'},
      {x1: 4, y1: 9.5, x2: 5, y2: 9.5, c:'chocolate', w:8, r:'chest'},
      {x1: 5, y1: 10, x2: 6, y2: 11, c:'brown', w:8, r:'chest'},

      // Legs
      // Front Left leg
      {x:3,y:13,c:'brown', r:'frontLeftLeg'}, {x:4,y:13,c:'brown', r:'frontLeftLeg'}, {x:4,y:12,c:'brown', r:'frontLeftLeg'}, {x:4,y:11,c:'brown', r:'frontLeftLeg'},
      {x1: 4, y1: 12.5, x2: 5, y2: 12.5, c:'chocolate', w:8, r:'frontLeftLeg'},
      {x1: 4, y1: 11.5, x2: 5, y2: 11.5, c:'chocolate', w:8, r:'frontLeftLeg'},

      // Front Right leg
      {x:5,y:13,c:'brown', r:'frontRightLeg'}, {x:6,y:13,c:'brown', r:'frontRightLeg'}, {x:6,y:12,c:'brown', r:'frontRightLeg'}, {x:6,y:11,c:'brown', r:'frontRightLeg'},
      {x1: 6, y1: 12.5, x2: 7, y2: 12.5, c:'chocolate', w:8, r:'frontRightLeg'},
      {x1: 6, y1: 11.5, x2: 7, y2: 11.5, c:'chocolate', w:8, r:'frontRightLeg'},

      // Back Left leg
      {x:7,y:13,c:'brown', r:'backLeftLeg'}, {x:8,y:12,c:'brown', r:'backLeftLeg'}, {x:8,y:13,c:'brown', r:'backLeftLeg'}, {x:8,y:11,c:'brown', r:'backLeftLeg'}, {x:9,y:11,c:'brown', r:'backLeftLeg'}, {x:9,y:12,c:'brown', r:'backLeftLeg'},
      {x1: 8, y1: 13, x2: 9, y2: 12, c:'chocolate', w:8, r:'backLeftLeg'},
      {x1: 9, y1: 12, x2: 10, y2: 11, c:'chocolate', w:8, r:'backLeftLeg'},

      // Back Right leg
      {x:9,y:13,c:'brown', r:'backRightLeg'}, {x:10,y:13,c:'brown', r:'backRightLeg'}, {x:11,y:13,c:'brown', r:'backRightLeg'}, {x:10,y:12,c:'brown', r:'backRightLeg'}, {x:11,y:12,c:'brown', r:'backRightLeg'}, {x:10,y:11,c:'brown', r:'backRightLeg'}, {x:11,y:11,c:'brown', r:'backRightLeg'},
      {x1: 10, y1: 13, x2: 11, y2: 12, c:'chocolate', w:8, r:'backRightLeg'},
      {x1: 11, y1: 12, x2: 12, y2: 11, c:'chocolate', w:8, r:'backRightLeg'},
      {x1: 11, y1: 13, x2: 12, y2: 12, c:'chocolate', w:8, r:'backRightLeg'},

      // Nails
      {x1: 3.5, y1: 13, x2: 3, y2: 14, c:'black', w:8, r:'nails'},
      {x1: 5.5, y1: 13, x2: 5, y2: 14, c:'black', w:8, r:'nails'},
      {x1: 7.5, y1: 13, x2: 7, y2: 14, c:'black', w:8, r:'nails'},
      {x1: 9.5, y1: 13, x2: 9, y2: 14, c:'black', w:8, r:'nails'},
    ],

    tail: [
      {x:12,y:10,c:'brown', r:'tail'}, {x:12,y:9,c:'brown', r:'tail'}, {x:12,y:7,c:'brown', r:'tail'}, {x:12,y:8,c:'brown', r:'tail'},
      {x:11,y:6,c:'brown', r:'tail'},
      {x1:12, y1:12, x2:13, y2:11, c:'brown', w:8, r:'tail'},
      {x1:11, y1:6, x2:12, y2:7, c:'brown', w:8, r:'tail'},
      // Tabby stripes on tail
      {x1: 12, y1: 9.5, x2: 13, y2: 9.5, c:'chocolate', w:8, r:'tail'},
      {x1: 12, y1: 8.5, x2: 13, y2: 8.5, c:'chocolate', w:8, r:'tail'},
      {x1: 12, y1: 7.5, x2: 13, y2: 7.5, c:'chocolate', w:8, r:'tail'},
    ]
  };
}

function drawCatDefault() {
  // use the global `PALETTE` for color definitions

  // Create cat structure based on whether it's a tabby cat
  let head, body, tail;
  
  if (window.useTabbyTemplate === true) {
    console.log("[CAT] ✓ Drawing TABBY cat template");
    // Use tabby structure
    const tabbyStructure = createTabbyCat();
    head = tabbyStructure.head;
    body = tabbyStructure.body;
    tail = tabbyStructure.tail;
  } else {
    console.log("[CAT] Drawing default CALICO cat");
    // Use default calico structure
    // Head
    head = [
      // Face
      {x:3,y:2,c:'orange', r:'face'}, {x:3,y:3,c:'orange', r:'face'}, {x:3,y:4,c:'orange', r:'face'},
      {x:3,y:5,c:'white', r:'face'},
      {x:4,y:3,c:'black', r:'face'}, {x:4,y:5,c:'white', r:'face'},
      {x:5,y:3,c:'white', r:'face'}, {x:5,y:4,c:'white', r:'face'}, {x:5,y:5,c:'white', r:'face'},
      {x:6,y:3,c:'orange', r:'face'}, {x:6,y:5,c:'white', r:'face'},
      {x:7,y:2,c:'orange', r:'face'}, {x:7,y:3,c:'orange', r:'face'}, {x:7,y:4,c:'orange', r:'face'}, {x:7,y:5,c:'white', r:'face'},
      {x1: 3, y1: 5, x2: 4, y2: 6, c:'orange', w:8, r:'face'},
   
      // Eyes
        {x:4,y:4,c:'green', r:'eyeL'}, {x:6,y:4,c:'green', r:'eyeR'},

      // Nose & Mouth
        {x1: 5, y1: 5, x2: 6, y2: 5, c:'pink', w:8, r:'nose'},
        {x1: 5, y1: 5, x2: 5.5, y2: 6, c:'pink', w:8, r:'nose'},
        {x1: 6, y1: 5, x2: 5.5, y2: 6, c:'pink', w:8, r:'nose'},
        {x1: 5, y1: 6, x2: 6, y2: 6, c:'pink', w:8, r:'nose'},

      // Ears (should be face color)
      {x1: 3, y1: 2, x2: 4, y2: 3, c:'black', w:8, r:'face'},
      {x1: 8, y1: 2, x2: 7, y2: 3, c:'orange', w:8, r:'face'}
    ];

    // Body
    body = [
      {x:6,y:7,c:'black', r:'body'}, {x:6,y:8,c:'black', r:'body'}, {x:6,y:9,c:'white', r:'chest'},
      {x:7,y:6,c:'orange', r:'body'}, {x:7,y:7,c:'orange', r:'body'}, {x:7,y:8,c:'orange', r:'body'}, {x:7,y:9,c:'black', r:'body'}, {x:7,y:10,c:'orange', r:'body'},
      {x:8,y:6,c:'black', r:'body'}, {x:8,y:7,c:'black', r:'body'}, {x:8,y:8,c:'orange', r:'body'}, {x:8,y:9,c:'orange', r:'body'}, {x:8,y:10,c:'orange', r:'body'},
      {x:9,y:7,c:'orange', r:'body'}, {x:9,y:8,c:'orange', r:'body'}, {x:9,y:9,c:'orange', r:'body'}, {x:9,y:10,c:'orange', r:'body'},
      {x:10,y:9,c:'black', r:'body'}, {x:10,y:10,c:'orange', r:'body'},

     // Chest
      {x:4,y:6,c:'white', r:'chest'}, {x:4,y:7,c:'white', r:'chest'}, {x:4,y:8,c:'white', r:'chest'}, {x:4,y:9,c:'white', r:'chest'}, {x:4,y:10,c:'white', r:'chest'},
      {x:5,y:6,c:'white', r:'chest'}, {x:5,y:7,c:'white', r:'chest'}, {x:5,y:8,c:'white', r:'chest'}, {x:5,y:9,c:'white', r:'chest'}, {x:5,y:10,c:'white', r:'chest'},
      {x:6,y:6,c:'white', r:'chest'}, {x:6,y:10,c:'white', r:'chest'},
      {x1:6, y1:9, x2:7, y2:10, c:'orange', w:8, r:'body'},
      {x1:8, y1:6, x2:9, y2:7, c:'black', w:8, r:'body'},
      {x1:9, y1:7, x2:10, y2:8, c:'orange', w:8, r:'body'},
      {x1:10, y1:8, x2:11, y2:9, c:'black', w:8, r:'body'},
      {x1:8, y1:10, x2:9, y2:11, c:'orange', w:8, r:'body'},

      // Legs
      // Front Left leg
      {x:3,y:13,c:'white', r:'frontLeftLeg'}, {x:4,y:13,c:'white', r:'frontLeftLeg'}, {x:4,y:12,c:'white', r:'frontLeftLeg'}, {x:4,y:11,c:'white', r:'frontLeftLeg'},
      // Front Right leg
      {x:5,y:13,c:'white', r:'frontRightLeg'}, {x:6,y:13,c:'white', r:'frontRightLeg'}, {x:6,y:12,c:'white', r:'frontRightLeg'}, {x:6,y:11,c:'white', r:'frontRightLeg'},
      // Back Left leg
      {x:7,y:13,c:'white', r:'backLeftLeg'}, {x:8,y:12,c:'white', r:'backLeftLeg'}, {x:8,y:13,c:'white', r:'backLeftLeg'}, {x:8,y:11,c:'orange', r:'backLeftLeg'}, {x:9,y:11,c:'black', r:'backLeftLeg'}, {x:9,y:12,c:'black', r:'backLeftLeg'},
      // Back Right leg
      {x:9,y:13,c:'white', r:'backRightLeg'}, {x:10,y:13,c:'white', r:'backRightLeg'}, {x:11,y:13,c:'white', r:'backRightLeg'}, {x:10,y:12,c:'black', r:'backRightLeg'}, {x:11,y:12,c:'black', r:'backRightLeg'}, {x:10,y:11,c:'orange', r:'backRightLeg'}, {x:11,y:11,c:'orange', r:'backRightLeg'},
     
      // Nails
      {x1: 3.5, y1: 13, x2: 3, y2: 14, c:'pink', w:8, r:'nails'},
      {x1: 5.5, y1: 13, x2: 5, y2: 14, c:'pink', w:8, r:'nails'},
      {x1: 7.5, y1: 13, x2: 7, y2: 14, c:'pink', w:8, r:'nails'},
      {x1: 9.5, y1: 13, x2: 9, y2: 14, c:'pink', w:8, r:'nails'},
    ];

    // Tail
    tail = [
      {x:12,y:10,c:'orange', r:'tail'}, {x:12,y:9,c:'orange', r:'tail'}, {x:12,y:7,c:'orange', r:'tail'}, {x:12,y:8,c:'black', r:'tail'},
      {x:11,y:6,c:'orange', r:'tail'},
      {x1:12, y1:12, x2:13, y2:11, c:'orange', w:8, r:'tail'},
      {x1:11, y1:6, x2:12, y2:7, c:'orange', w:8, r:'tail'},
    ];
  }

  // First pass: dots
  [['head', head], ['body', body], ['tail', tail]].forEach(([regionName, arr]) => {
    arr.forEach(h => {
      if (h.x !== undefined) {
        // Skip drawing eyes if they're closed (blinking)
        if (window.blinkState === 'closed' && (h.r === 'eyeL' || h.r === 'eyeR')) {
          return; // Skip eye dots during blink
        }
        dot(h.x, h.y, h.c, regionName, h);
      }
    });
  });

  // Second pass: lines (drawn on top)
  [['head', head], ['body', body], ['tail', tail]].forEach(([regionName, arr]) => {
    arr.forEach(h => {
      if (h.x1 !== undefined) {
        // resolve stroke color with region-aware overrides
        const base = window.PALETTE && window.PALETTE[h.c] ? window.PALETTE[h.c] : h.c;
        let useStroke = base;
        
        // Check if this should be a tabby stripe FIRST before applying region overrides
        let isTabbyStripe = false;
        if (window.useTabbyTemplate === true && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES._tabbyStripeColor) {
          if (h.c === 'chocolate') {
            isTabbyStripe = true;
          }
        }
        
        // Apply region overrides UNLESS this is a tabby stripe
        if (!isTabbyStripe) {
          try {
            let regApplied = false;
            if (window && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES[regionName]) {
              const reg = window.PALETTE_REGION_OVERRIDES[regionName];
              // Check r2 first (for individual line patches), then r, then color key
              if (h.r2 && reg[h.r2]) { useStroke = reg[h.r2]; regApplied = true; }
              else if (h.r && reg[h.r]) { useStroke = reg[h.r]; regApplied = true; }
              else if (reg[h.c]) { useStroke = reg[h.c]; regApplied = true; }
              else if (reg._default) { useStroke = reg._default; regApplied = true; }
            }
            // Apply the global line override only when no region-level override matched.
            if (!regApplied && window && window.LINE_COLOR_OVERRIDE) useStroke = window.LINE_COLOR_OVERRIDE;
          } catch (e) {}
        }
        
        // Apply tabby stripe color override if this is a tabby cat with chocolate stripes
        // Replace chocolate color with custom stripe color
        if (window.useTabbyTemplate === true && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES._tabbyStripeColor) {
          // Check if this line should be a stripe (has c='chocolate')
          if (h.c === 'chocolate') {
            useStroke = window.PALETTE_REGION_OVERRIDES._tabbyStripeColor;
            console.log("[RENDER] Applied stripe color override:", window.PALETTE_REGION_OVERRIDES._tabbyStripeColor);
          }
        }
        
        // Apply calico randomization to lines if enabled
        if (window.isCalicoCat) {
          const lineKey = `line_${h.x1}_${h.y1}_${h.x2}_${h.y2}`;
          if (!window.calicoSeed[lineKey]) {
            const calicoColors = ['white', 'orange', 'black'];
            const randomIndex = Math.floor(Math.random() * calicoColors.length);
            const selectedColorName = calicoColors[randomIndex];
            const hexColor = (window && window.PALETTE && window.PALETTE[selectedColorName])
              ? window.PALETTE[selectedColorName]
              : selectedColorName;
            window.calicoSeed[lineKey] = hexColor;
          }
          useStroke = window.calicoSeed[lineKey];
        }
        
        // Apply random line color for texture on solid-color cats
        if (window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES._randomLineColor && !window.isCalicoCat && !window.useTabbyTemplate) {
          const lineKey = `random_line_${h.x1}_${h.y1}_${h.x2}_${h.y2}`;
          if (!window.randomLineSeed) {
            window.randomLineSeed = {};
          }
          if (!window.randomLineSeed[lineKey]) {
            // Randomly decide if this line gets the alternate color (30% chance)
            window.randomLineSeed[lineKey] = Math.random() < 0.3;
          }
          if (window.randomLineSeed[lineKey]) {
            useStroke = window.PALETTE_REGION_OVERRIDES._randomLineColor;
          }
        }
        
        push();
        stroke(useStroke);
        strokeWeight(12);
        strokeCap(SQUARE);
        const x1 = (h.x1 + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell;
        const y1 = (h.y1 + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell;
        const x2 = (h.x2 + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell;
        const y2 = (h.y2 + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell;
        line(x1, y1, x2, y2);
        noStroke();
        pop();
      }
    });
  });
}

// Generate SVG from the same arrays. options: { bg: true|false }
function getCatSVG(options) {
  options = options || {};
  const includeBG = !!options.bg;
  const width = cols * cell;
  const height = rows * cell;
  const escape = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

  // Determine background color to embed in exported SVG.
  // Prefer `options.bgColor` if provided, otherwise try to read computed body background.
  function rgbStringToHex(rgb) {
    if (!rgb) return null;
    // already hex
    if (rgb[0] === '#') return rgb;
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  let exportBG = null;
  if (includeBG) {
    if (options.bgColor) exportBG = options.bgColor;
    else {
      try {
        const cs = window && window.getComputedStyle ? window.getComputedStyle(document.body) : null;
        if (cs) {
          const bg = cs.backgroundColor || cs.background || null;
          exportBG = rgbStringToHex(bg) || null;
        }
      } catch (e) { exportBG = null; }
    }
    if (!exportBG) exportBG = '#EEE9E2'; // fallback to page background used in CSS
  }

  let parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  // If requested, include a background rect (does not affect on-page canvas transparency).
  if (includeBG) {
    parts.push(`  <rect width="100%" height="100%" fill="${escape(exportBG)}"/>`);
  }

  [['head', head], ['body', body], ['tail', tail]].forEach(([regionName, arr]) => {
    arr.forEach(item => {
      if (typeof item.x !== 'undefined') {
        const cx = (item.x + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell + cell/2;
        const cy = (item.y + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell + cell/2;
        const r = cell/2;
        let col = (window && window.PALETTE && window.PALETTE[item.c]) ? window.PALETTE[item.c] : (item.c || '#000');
        try {
          if (window && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES[regionName]) {
            const reg = window.PALETTE_REGION_OVERRIDES[regionName];
            if (item && item.r && reg[item.r]) col = reg[item.r];
            else if (reg[item.c]) col = reg[item.c];
            else if (reg._default) col = reg._default;
          }
          if (window && window.DOT_COLOR_OVERRIDE) col = window.DOT_COLOR_OVERRIDE;
        } catch (e) {}
        parts.push(`  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${escape(col)}"/>`);
      }
    });
  });

  [['head', head], ['body', body], ['tail', tail]].forEach(([regionName, arr]) => {
    arr.forEach(item => {
      if (typeof item.x1 !== 'undefined') {
        const x1 = (item.x1 + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell;
        const y1 = (item.y1 + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell;
        const x2 = (item.x2 + (typeof OFFSET_X !== 'undefined' ? OFFSET_X : 0)) * cell;
        const y2 = (item.y2 + (typeof OFFSET_Y !== 'undefined' ? OFFSET_Y : 0)) * cell;
        let col = (window && window.PALETTE && window.PALETTE[item.c]) ? window.PALETTE[item.c] : (item.c || '#000');
        try {
          if (window && window.PALETTE_REGION_OVERRIDES && window.PALETTE_REGION_OVERRIDES[regionName]) {
            const reg = window.PALETTE_REGION_OVERRIDES[regionName];
            if (item && item.r && reg[item.r]) col = reg[item.r];
            else if (reg[item.c]) col = reg[item.c];
            else if (reg._default) col = reg._default;
          }
          if (window && window.LINE_COLOR_OVERRIDE) col = window.LINE_COLOR_OVERRIDE;
        } catch (e) {}
        const w = 12;
        parts.push(`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escape(col)}" stroke-width="${w}" stroke-linecap="square"/>`);
      }
    });
  });

  parts.push('</svg>');
  return parts.join('\n');
}

// expose globally for the page to use
window.getCatSVG = getCatSVG;

// Return a PNG data URL of the displayed canvas, composited over the page background.
function _rgbStringToHex(rgb) {
  if (!rgb) return null;
  if (rgb[0] === '#') return rgb;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  const r = parseInt(m[1],10), g = parseInt(m[2],10), b = parseInt(m[3],10);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase();
}

function getCatPNG(options) {
  options = options || {};
  const canvas = document.querySelector('canvas') || document.getElementById('defaultCanvas0');
  if (!canvas) return null;

  // ---- resize cat to 384 x 384 ----
  const TARGET = 384;

  // draw cat onto a temp canvas
  const tmp = document.createElement('canvas');
  tmp.width = TARGET;
  tmp.height = TARGET;
  const ctx = tmp.getContext('2d');

  // fill background
  let bg = options.bgColor || '#FFFFFF';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, TARGET, TARGET);

  // draw scaled cat
  ctx.drawImage(canvas, 0, 0, TARGET, TARGET);

  // ---- convert to bitmap array (0/1) ----
  const imgData = ctx.getImageData(0, 0, TARGET, TARGET).data;

  // return PNG data URL
  return tmp.toDataURL('image/png');
}

window.getCatBitmap = function() {
  const TARGET = 384;

  // read the on-screen canvas
  const src = document.querySelector("canvas") || document.getElementById("defaultCanvas0");
  if (!src) return null;

  // scale to 384×384
  const tmp = document.createElement("canvas");
  tmp.width = TARGET;
  tmp.height = TARGET;
  const ctx = tmp.getContext("2d");
  ctx.drawImage(src, 0, 0, TARGET, TARGET);

  // get data
  let img = ctx.getImageData(0, 0, TARGET, TARGET);
  let d = img.data;

  // --- 1) convert to grayscale ---
  let gray = new Float32Array(TARGET * TARGET);
  for (let i = 0; i < TARGET * TARGET; i++) {
    const r = d[i * 4 + 0];
    const g = d[i * 4 + 1];
    const b = d[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // --- 2) Floyd–Steinberg dithering to 0/255 ---
  let bw = new Uint8Array(TARGET * TARGET);

  function clamp(x) { return Math.min(255, Math.max(0, x)); }

  for (let y = 0; y < TARGET; y++) {
    for (let x = 0; x < TARGET; x++) {
      let i = y * TARGET + x;
      let old = gray[i];
      let newVal = old < 128 ? 0 : 255;
      bw[i] = newVal;
      let err = old - newVal;

      if (x + 1 < TARGET) gray[i + 1] += err * 7 / 16;
      if (y + 1 < TARGET) {
        if (x > 0) gray[i + TARGET - 1] += err * 3 / 16;
        gray[i + TARGET] += err * 5 / 16;
        if (x + 1 < TARGET) gray[i + TARGET + 1] += err * 1 / 16;
      }
    }
  }

  // --- 3) pack 8 pixels into 1 byte ---
  const bytesPerRow = TARGET / 8; // = 48
  let outBytes = [];

  for (let y = 0; y < TARGET; y++) {
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        let x = bx * 8 + bit;
        let v = bw[y * TARGET + x] === 0 ? 1 : 0; // black = 1
        byte |= (v << (7 - bit));
      }
      outBytes.push(byte);
    }
  }

  // --- 4) stringify like "0x00,0x1F,..." ---
  const hexString = outBytes
    .map(b => "0x" + b.toString(16).padStart(2, "0"))
    .join(",");

  console.log("BITMAP STRING (384×384, packed):");
  console.log(hexString);

  return hexString;
};



function downloadCatPNG(filename, options) {
  const data = getCatPNG(options) || '';
  if (!data) return;
  const a = document.createElement('a');
  a.href = data;
  a.download = filename || 'cat.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

window.getCatPNG = getCatPNG;
window.downloadCatPNG = downloadCatPNG;

// Redraw helpers and runtime offset setter
function redrawCat() {
  const canvas = document.querySelector('canvas') || document.getElementById('defaultCanvas0');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // clear the canvas and redraw
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCatDefault();
}

function setCatOffset(x, y) {
  OFFSET_X = Number(x) || 0;
  OFFSET_Y = Number(y) || 0;
  redrawCat();
}

window.setCatOffset = setCatOffset;
window.redrawCat = redrawCat;

// --- Initial white theme + input toggle ---------------------------------
// Start the page with the whole cat white except two eyes colored
window.applyInitialWhite = function() {
  try {
    window.PALETTE_REGION_OVERRIDES = {
      head: {
        _default: '#FFFFFF',
        // left eye -> blue, right eye -> blue (default per requirement)
        eyeL: (window && window.PALETTE && window.PALETTE.blue) ? window.PALETTE.blue : '#81A1CA',
        eyeR: (window && window.PALETTE && window.PALETTE.blue) ? window.PALETTE.blue : '#81A1CA',
        // nose & mouth should be pink in initial white theme
        nose: (window && window.PALETTE && window.PALETTE.pink) ? window.PALETTE.pink : '#E3916E',
        earL: (window && window.PALETTE && window.PALETTE.pink) ? window.PALETTE.pink : '#E3916E',
        earR: (window && window.PALETTE && window.PALETTE.pink) ? window.PALETTE.pink : '#E3916E'
      },
      body: { _default: '#FFFFFF', nail: (window && window.PALETTE && window.PALETTE.pink) ? window.PALETTE.pink : '#E3916E' },
      tail: { _default: '#FFFFFF' }
    };
    // Make lines white too
    window.LINE_COLOR_OVERRIDE = '#FFFFFF';
  } catch (e) {}
  try { window.redrawCat(); } catch (e) {}
};

window.clearColorOverrides = function() {
  try { delete window.PALETTE_REGION_OVERRIDES; } catch (e) {}
  try { delete window.LINE_COLOR_OVERRIDE; } catch (e) {}
  try { delete window.DOT_COLOR_OVERRIDE; } catch (e) {}
  try { window.redrawCat(); } catch (e) {}
};

// If the page already has the input, wire it up; otherwise wait for load.
function _maybeWireColorInput() {
  const input = document.getElementById('colorToggleInput');
  const finish = document.getElementById('finishButton');
  const reset = document.getElementById('resetButton');
  // if neither control exists, bail
  if (!input && !finish && !reset) return false;

  if (finish) {
    finish.addEventListener('click', function() {
      // Keep the current cat displayed - don't clear the color overrides
      // The color overrides will persist and the cat stays as-is
    });
  }

  if (reset) {
    reset.addEventListener('click', function() {
      // Meow button refreshes the page
      location.reload();
    });
  }

  // do not auto-switch on input events anymore
  return true;
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // DOM may already be ready
  _maybeWireColorInput();
  // Do NOT apply initial white theme; start with the calico cat
} else {
  window.addEventListener('load', function() {
    _maybeWireColorInput();
    // Do NOT apply initial white theme; start with the calico cat
  });
}

// ============================================================================
// BLINKING ANIMATION SYSTEM
// ============================================================================
window.blinkState = 'open'; // 'open' or 'closed'
window.blinkTimer = null;
window.blinkSequence = 0;

function performBlinkStep() {
  const steps = [
    { state: 'closed', duration: 200 }, // Close for 200ms
    { state: 'open', duration: 150 },   // Open for 150ms
    { state: 'closed', duration: 200 }, // Close again for 200ms
    { state: 'open', duration: 150 }    // Open again for 150ms
  ];
  
  if (window.blinkSequence < steps.length) {
    window.blinkState = steps[window.blinkSequence].state;
    
    // Redraw the canvas with or without blink lines
    const canvas = document.querySelector('canvas') || document.getElementById('defaultCanvas0');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCatDefault();
      
      // Draw blink lines if eyes are closed
      if (window.blinkState === 'closed') {
        const leftEyeX = (4 + OFFSET_X) * cell + cell/2;
        const leftEyeY = (4 + OFFSET_Y) * cell + cell/2;
        const rightEyeX = (6 + OFFSET_X) * cell + cell/2;
        const rightEyeY = (4 + OFFSET_Y) * cell + cell/2;
        
        const eyeColor = getCurrentEyeColor();
        
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = 12; // Match other line weight
        ctx.lineCap = 'butt'; // Square ends like other lines
        
        // Left eye - horizontal line
        ctx.beginPath();
        ctx.moveTo(leftEyeX - cell/2, leftEyeY);
        ctx.lineTo(leftEyeX + cell/2, leftEyeY);
        ctx.stroke();
        
        // Right eye - horizontal line
        ctx.beginPath();
        ctx.moveTo(rightEyeX - cell/2, rightEyeY);
        ctx.lineTo(rightEyeX + cell/2, rightEyeY);
        ctx.stroke();
      }
    }
    
    window.blinkTimer = setTimeout(() => {
      window.blinkSequence++;
      performBlinkStep();
    }, steps[window.blinkSequence].duration);
  } else {
    // Blink sequence done, wait 4 seconds before next blink
    window.blinkSequence = 0;
    window.blinkTimer = setTimeout(() => {
      performBlinkStep();
    }, 4000);
  }
}

function startBlinking() {
  if (window.blinkTimer) clearTimeout(window.blinkTimer);
  window.blinkSequence = 0;
  window.blinkState = 'open';
  redrawCat();
  performBlinkStep();
}

// Start blinking after a short delay to ensure canvas is ready
window.addEventListener('load', () => {
  setTimeout(() => startBlinking(), 1000);
});

// Also try if already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => startBlinking(), 1000);
}

window.startBlinking = startBlinking;
window.stopBlinking = () => {
  if (window.blinkTimer) clearTimeout(window.blinkTimer);
  window.blinkTimer = null;
  window.blinkSequence = 0;
  window.blinkState = 'open';
  redrawCat();
};
