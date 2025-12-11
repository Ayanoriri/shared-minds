/**
 * LLM-powered color pipeline for the cat drawing app.
 * Uses the Replicate proxy (via /api/create_n_get) to request color suggestions from Claude.
 * Parses the response, maps colors to the available PALETTE, and applies region overrides.
 */

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

// Proxy endpoint (matches week6-social setup)
const REPLICATE_PROXY = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";

// Replicate model version for GPT-5 Nano (OpenAI's fastest model)
// Full path: openai/gpt-5-nano
const GPT_5_NANO_VERSION = "openai/gpt-5-nano";

// Timeout for LLM requests (ms)
const LLM_TIMEOUT_MS = 15000;

// Heuristic color keywords (fallback if LLM fails)
const COLOR_KEYWORDS = {
  orange: "#FF8C42",
  red: "#FF0000",
  brown: "#8B4513",
  white: "#FFFFFF",
  black: "#000000",
  grey: "#808080",
  gray: "#808080",
  pink: "#FFC0CB",
  yellow: "#FFFF00",
  green: "#008000",
  blue: "#0000FF",
  purple: "#800080",
  tan: "#D2B48C",
  beige: "#F5F5DC",
  ginger: "#FF8C00",
  tabby: "#8B4513",
  calico: "#FF8C42",
  tortoiseshell: "#8B4513",
};

// ============================================================================
// HELPER: Normalize hex color
// ============================================================================

function normalizeColorHex(colorStr) {
  if (!colorStr) return null;
  colorStr = colorStr.trim();
  // already hex
  if (colorStr.startsWith("#")) {
    return colorStr.length === 7 ? colorStr : null;
  }
  // try DOM color resolution
  try {
    const el = document.createElement("div");
    el.style.color = colorStr;
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      return (
        "#" +
        [r, g, b]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase()
      );
    }
  } catch (e) {}
  return null;
}

// ============================================================================
// HELPER: Get PALETTE (wait for it to be available from cat.js)
// ============================================================================

function getPalette() {
  // First try window.PALETTE (set by palette.js after load)
  if (window.PALETTE) {
    return window.PALETTE;
  }
  // Fallback: return a default palette if palette.js hasn't loaded yet
  return {
    white: "#ffffff",
    black: "#3A3226",
    beige: "#DCB879",
    lightBrown: "#B4A582",
    lightGrey: "#B19693",
    yellow: "#CAAD5F",
    orange: "#E3916E",
    pink: "#FFC0CB",
    green: "#838A2D",
    blue: "#69B0AC",
    khaki: "#7D6C46",
    brown: "#9B6E23",
    cyan: "#69B0AC"
  };
}

// ============================================================================
// HELPER: Find closest color in PALETTE by Euclidean RGB distance
// ============================================================================

function findClosestPaletteColor(hexOrName) {
  const palette = getPalette();

  // First, check if it's an exact match in the palette (case-insensitive)
  const lower = (hexOrName || "").toLowerCase();
  for (const [key, hex] of Object.entries(palette)) {
    if (key.toLowerCase() === lower) {
      return hex;
    }
  }

  // If not an exact match, try to normalize to hex
  let targetHex = normalizeColorHex(hexOrName);
  if (!targetHex) {
    // try keyword lookup
    targetHex = COLOR_KEYWORDS[lower];
  }
  if (!targetHex) return null;

  // parse target hex to RGB
  const tR = parseInt(targetHex.slice(1, 3), 16);
  const tG = parseInt(targetHex.slice(3, 5), 16);
  const tB = parseInt(targetHex.slice(5, 7), 16);

  let bestKey = null;
  let bestDist = Infinity;

  for (const [key, hex] of Object.entries(palette)) {
    const pR = parseInt(hex.slice(1, 3), 16);
    const pG = parseInt(hex.slice(3, 5), 16);
    const pB = parseInt(hex.slice(5, 7), 16);
    const dist = Math.sqrt(
      (tR - pR) ** 2 + (tG - pG) ** 2 + (tB - pB) ** 2
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
  }

  return bestKey ? palette[bestKey] : null;
}

// ============================================================================
// MAIN: Request color suggestions from Claude via Replicate proxy
// ============================================================================

async function requestColorSuggestionsFromLLM(catDescription) {
  if (!catDescription || catDescription.trim().length === 0) {
    console.warn("Empty cat description");
    return null;
  }

  // Build a prompt that intelligently infers all cat colors from the description
  const fullPrompt = `You are an expert cat color analyzer. Based on this cat description, intelligently infer the colors for cat parts:

"${catDescription}"

INSTRUCTIONS:
1. Think about real cat breeds and their typical color patterns
2. "cow cat" or "tuxedo" = black and white pattern (black body, white chest)
3. If the user mentions specific colors or breeds, use those
4. If not mentioned, infer realistic colors based on the breed/description
5. For noseMouthNails: Choose ONE of: "pink", "black", or "grey" based on cat's overall color (dark cats = black, light cats = pink, medium/grey cats = grey)
6. If user mentions nose patches/spots/mixed colors (e.g., "white patches on nose"), also return nosePatch with the secondary color
7. For any part you're unsure about: use "white" as default
8. Return colors for 8-9 parts (nosePatch is optional)

Real cat color examples:
- Orange tabby: face=orange, body=orange, chest=white, ears=orange, legs=orange, eyes=green, tail=orange, noseMouthNails=pink
- Black cat: face=black, body=black, chest=black, ears=black, legs=black, eyes=gold, tail=black, noseMouthNails=black
- Cow cat: face=black, body=black, chest=white, ears=black, legs=black, eyes=green, tail=black, noseMouthNails=black
- Tuxedo cat: face=black, body=black, chest=white, ears=black, legs=black, eyes=yellow, tail=black, noseMouthNails=black
- Calico: face=orange, body=orange, chest=white, ears=orange, legs=orange, eyes=yellow, tail=orange, noseMouthNails=black
- Siamese: face=cream, body=cream, chest=cream, ears=darkbrown, legs=darkbrown, eyes=blue, tail=darkbrown, noseMouthNails=grey
- White Persian: face=white, body=white, chest=white, ears=white, legs=white, eyes=blue, tail=white, noseMouthNails=pink
- Brown tabby: face=brown, body=brown, chest=white, ears=brown, legs=brown, eyes=green, tail=brown, noseMouthNails=black
- Grey cat: face=grey, body=grey, chest=white, ears=grey, legs=grey, eyes=yellow, tail=grey, noseMouthNails=grey

Output ONLY a valid JSON object with no other text:
{
  "face": "<color>",
  "body": "<color>",
  "chest": "<color>",
  "ears": "<color>",
  "legs": "<color>",
  "eyes": "<color>",
  "tail": "<color>",
  "noseMouthNails": "pink or black or grey",
  "nosePatch": "optional: pink or black or grey (only if user mentions nose patches)"
}`;

  // Payload for Replicate's GPT-5 Nano model
  const payload = {
    version: GPT_5_NANO_VERSION,
    input: {
      prompt: fullPrompt,
      max_tokens: 256,
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    console.log("Sending payload to proxy:", payload);

    const response = await fetch(REPLICATE_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`LLM request failed: ${response.status} ${response.statusText}`);
      // Log the response body for debugging
      try {
        const errData = await response.json();
        console.warn("Proxy error details:", errData);
      } catch (e) {
        const errText = await response.text();
        console.warn("Proxy error (raw):", errText);
      }
      return null;
    }

    const data = await response.json();
    console.log("LLM response:", data);

    // Extract the output text from the proxy response
    let outputText = null;
    if (data.output && typeof data.output === "string") {
      outputText = data.output;
    } else if (data.output && Array.isArray(data.output)) {
      outputText = data.output.join("");
    } else if (data.text) {
      outputText = data.text;
    } else if (typeof data === "string") {
      outputText = data;
    }

    if (!outputText) {
      console.warn("No output text in LLM response");
      return null;
    }

    console.log("Raw output text:", outputText);

    // Try to parse JSON from the output
    let colorSuggestions = null;
    try {
      // Extract JSON from the output (in case there's extra text)
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        colorSuggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn("Failed to parse LLM JSON response:", parseErr);
      return null;
    }

    if (!colorSuggestions) {
      console.warn("No valid color suggestions in LLM response");
      return null;
    }

    // Map to palette and return
    // LLM returns 8 components including noseMouthNails (which must be "pink", "black", or "grey")
    const noseMouthNailsValue = (colorSuggestions.noseMouthNails || "pink").toLowerCase();
    let noseMouthNailsColor;
    if (noseMouthNailsValue.includes("black")) {
      noseMouthNailsColor = findClosestPaletteColor("black");
    } else if (noseMouthNailsValue.includes("grey") || noseMouthNailsValue.includes("gray")) {
      noseMouthNailsColor = findClosestPaletteColor("lightGrey");
    } else {
      noseMouthNailsColor = findClosestPaletteColor("pink");
    }
    
    const result = {
      face: findClosestPaletteColor(colorSuggestions.face || "white"),
      body: findClosestPaletteColor(colorSuggestions.body || "white"),
      chest: findClosestPaletteColor(colorSuggestions.chest || "white"),
      ears: findClosestPaletteColor(colorSuggestions.ears || "white"),
      legs: findClosestPaletteColor(colorSuggestions.legs || "white"),
      eyes: findClosestPaletteColor(colorSuggestions.eyes || "blue"),
      tail: findClosestPaletteColor(colorSuggestions.tail || "white"),
      noseMouthNails: noseMouthNailsColor,
    };
    
    // If nosePatch is specified, add it
    if (colorSuggestions.nosePatch) {
      const nosePatchValue = colorSuggestions.nosePatch.toLowerCase();
      if (nosePatchValue.includes("black")) {
        result.nosePatch = findClosestPaletteColor("black");
      } else if (nosePatchValue.includes("grey") || nosePatchValue.includes("gray")) {
        result.nosePatch = findClosestPaletteColor("lightGrey");
      } else if (nosePatchValue.includes("white")) {
        result.nosePatch = findClosestPaletteColor("white");
      } else {
        result.nosePatch = findClosestPaletteColor("pink");
      }
    }
    
    return result;
  } catch (err) {
    console.warn("LLM request error:", err.message || err);
    return null;
  }
}

// ============================================================================
// HELPER: Apply color overrides to the cat
// ============================================================================

function applyColorOverridesToCat(colorMap) {
  if (!colorMap) {
    console.warn("No color map to apply");
    return;
  }

  try {
    // Initialize region overrides if needed
    if (!window.PALETTE_REGION_OVERRIDES) {
      window.PALETTE_REGION_OVERRIDES = {};
    }

    // Initialize all regions
    if (!window.PALETTE_REGION_OVERRIDES.head) {
      window.PALETTE_REGION_OVERRIDES.head = {};
    }
    if (!window.PALETTE_REGION_OVERRIDES.body) {
      window.PALETTE_REGION_OVERRIDES.body = {};
    }
    if (!window.PALETTE_REGION_OVERRIDES.tail) {
      window.PALETTE_REGION_OVERRIDES.tail = {};
    }

    // Apply face color (or white if not specified/unknown)
    const faceColor = colorMap.face ? findClosestPaletteColor(colorMap.face) : findClosestPaletteColor("white");
    if (faceColor) {
      window.PALETTE_REGION_OVERRIDES.head.face = faceColor;
    }

    // Apply body color (or white if not specified/unknown)
    const bodyColor = colorMap.body ? findClosestPaletteColor(colorMap.body) : findClosestPaletteColor("white");
    if (bodyColor) {
      window.PALETTE_REGION_OVERRIDES.body.body = bodyColor;
    }

    // Apply chest color (or white if not specified/unknown)
    const chestColor = colorMap.chest ? findClosestPaletteColor(colorMap.chest) : findClosestPaletteColor("white");
    if (chestColor) {
      window.PALETTE_REGION_OVERRIDES.body.chest = chestColor;
    }

    // Apply ears color (or white if not specified/unknown)
    const earsColor = colorMap.ears ? findClosestPaletteColor(colorMap.ears) : findClosestPaletteColor("white");
    if (earsColor) {
      window.PALETTE_REGION_OVERRIDES.head.ears = earsColor;
    }

    // Apply legs color (or white if not specified/unknown)
    const legsColor = colorMap.legs ? findClosestPaletteColor(colorMap.legs) : findClosestPaletteColor("white");
    if (legsColor) {
      window.PALETTE_REGION_OVERRIDES.body.legs = legsColor;
    }

    // Apply eye color (or blue if not specified/unknown)
    const eyeColor = colorMap.eyes ? findClosestPaletteColor(colorMap.eyes) : findClosestPaletteColor("blue");
    if (eyeColor) {
      window.PALETTE_REGION_OVERRIDES.head.eyeL = eyeColor;
      window.PALETTE_REGION_OVERRIDES.head.eyeR = eyeColor;
    }

    // Apply noseMouthNails color — MUST be pink, black, or grey (same for all three)
    const noseMouthNailsColor = colorMap.noseMouthNails || findClosestPaletteColor("pink");
    if (noseMouthNailsColor) {
      window.PALETTE_REGION_OVERRIDES.head.nose = noseMouthNailsColor;
      window.PALETTE_REGION_OVERRIDES.body.nails = noseMouthNailsColor;
      
      // If nosePatch is specified, randomly pick one nose line to be different
      if (colorMap.nosePatch) {
        const noseLineIndex = Math.floor(Math.random() * 4); // 0-3 for 4 nose lines
        const noseLineKey = `nose${noseLineIndex}`;
        window.PALETTE_REGION_OVERRIDES.head[noseLineKey] = colorMap.nosePatch;
      }
    }

    // Apply tail color (or white if not specified/unknown)
    const tailColor = colorMap.tail ? findClosestPaletteColor(colorMap.tail) : findClosestPaletteColor("white");
    if (tailColor) {
      window.PALETTE_REGION_OVERRIDES.tail.tail = tailColor;
    }

    // Redraw the cat with new colors
    if (typeof window.redrawCat === "function") {
      window.redrawCat();
    }

    console.log("Color overrides applied:", window.PALETTE_REGION_OVERRIDES);
  } catch (err) {
    console.warn("Failed to apply color overrides:", err);
  }
}

// ============================================================================
// MAIN PIPELINE: Called from the UI on "Finish" button click
// ============================================================================

window.applyColorsFromDescription = async function (description) {
  if (!description || description.trim().length === 0) {
    console.warn("Empty description, skipping LLM call");
    return;
  }

  console.log("Requesting colors for:", description);

  // Show loading state (optional)
  const finishBtn = document.getElementById("finishButton");
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = "Loading...";
  }

  try {
    // Request color suggestions from LLM
    const colorSuggestions = await requestColorSuggestionsFromLLM(description);

    if (colorSuggestions) {
      console.log("Color suggestions received:", colorSuggestions);
      applyColorOverridesToCat(colorSuggestions);
    } else {
      console.warn("No color suggestions returned from LLM; falling back to white cat");
      // On LLM failure, show the white cat
      if (typeof window.applyInitialWhite === 'function') {
        window.applyInitialWhite();
      }
    }
  } catch (err) {
    console.warn("Pipeline error:", err);
    // On error, show the white cat
    if (typeof window.applyInitialWhite === 'function') {
      window.applyInitialWhite();
    }
  } finally {
    // Restore button state
    if (finishBtn) {
      finishBtn.disabled = false;
      finishBtn.textContent = "draw";
    }
  }
};

// ============================================================================
// WIRE UP: Replace the existing "Finish" button handler with LLM pipeline
// ============================================================================

function wireUpLLMPipeline() {
  const finishBtn = document.getElementById("finishButton");
  const textarea = document.getElementById("colorToggleInput");

  if (!finishBtn || !textarea) {
    console.warn("Finish button or textarea not found; LLM pipeline not wired");
    return;
  }

  // Remove old click handlers (if any) by cloning the button
  const newBtn = finishBtn.cloneNode(true);
  finishBtn.parentNode.replaceChild(newBtn, finishBtn);

  // Add LLM-powered click handler
  newBtn.addEventListener("click", async function () {
    const description = textarea.value.trim();
    if (description.length > 0) {
      await window.applyColorsFromDescription(description);
    }
  });

  console.log("LLM pipeline wired to Finish button");
}

// Auto-wire on load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUpLLMPipeline);
} else {
  wireUpLLMPipeline();
}
