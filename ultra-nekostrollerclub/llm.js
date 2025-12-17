/**
 * LLM Color Pipeline - Generate cat colors from description via Claude
 */

const REPLICATE_PROXY = "https://itp-ima-replicate-proxy.web.app/api/create_n_get";
const GPT_5_NANO_VERSION = "openai/gpt-5-nano";
const LLM_TIMEOUT_MS = 15000;

const COLOR_KEYWORDS = {
  orange: "#DCB879", red: "#7D3F21", brown: "#B8AC98", white: "#ffffff",
  black: "#3A3226", grey: "#BDC0BA", pink: "#E69871", yellow: "#E9CD4C",
  green: "#70732D", blue: "#ADCBF1", purple: "#BBABAB", chocolate: "#928178",
  amber: "#B87333", ginger: "#DCB879", tabby: "#B8AC98",
};

function normalizeColorHex(colorStr) {
  if (!colorStr) return null;
  colorStr = colorStr.trim();
  if (colorStr.startsWith("#")) {
    return colorStr.length === 7 ? colorStr : null;
  }
  try {
    const el = document.createElement("div");
    el.style.color = colorStr;
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    }
  } catch (e) {}
  return null;
}

function getPalette() {
  if (window.PALETTE) {
    return window.PALETTE;
  }
  return {
    white: "#ffffff", black: "#3A3226", orange: "#DCB879", brown: "#B8AC98",
    lightGrey: "#B19693", yellow: "#CAAD5F", pink: "#E3916E", green: "#838A2D",
    blue: "#69B0AC", khaki: "#7D6C46", cyan: "#69B0AC", chocolate: "#928178",
    amber: "#B87333", red: "#7D3F21", grey: "#BDC0BA", darkgrey: "#78756C",
  };
}

function findClosestPaletteColor(hexOrName) {
  const palette = getPalette();
  const lower = (hexOrName || "").toLowerCase();
  
  for (const [key, hex] of Object.entries(palette)) {
    if (key.toLowerCase() === lower) {
      return hex;
    }
  }

  let targetHex = normalizeColorHex(hexOrName);
  if (!targetHex) {
    targetHex = COLOR_KEYWORDS[lower];
  }
  if (!targetHex) return null;

  const tR = parseInt(targetHex.slice(1, 3), 16);
  const tG = parseInt(targetHex.slice(3, 5), 16);
  const tB = parseInt(targetHex.slice(5, 7), 16);

  let bestKey = null, bestDist = Infinity;
  for (const [key, hex] of Object.entries(palette)) {
    const pR = parseInt(hex.slice(1, 3), 16);
    const pG = parseInt(hex.slice(3, 5), 16);
    const pB = parseInt(hex.slice(5, 7), 16);
    const dist = Math.sqrt((tR - pR) ** 2 + (tG - pG) ** 2 + (tB - pB) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
    }
  }
  return bestKey ? palette[bestKey] : null;
}

async function requestColorSuggestionsFromLLM(catDescription) {
  if (!catDescription || catDescription.trim().length === 0) {
    console.warn("Empty cat description");
    return null;
  }

  const fullPrompt = `Analyze this cat description and return realistic colors for each body part using ONLY these palette names: white, black, orange, brown, purple, pink, green, mustaurd, blue, yellow, chocolate, amber, red, grey, darkgrey.

Description: "${catDescription}"

Return JSON with these fields (use palette color names):
{
  "face": "color name",
  "body": "color name",
  "chest": "color name",
  "frontLeftLeg": "color name",
  "frontRightLeg": "color name",
  "backLeftLeg": "color name",
  "backRightLeg": "color name",
  "tail": "color name",
  "innerface": "color name",
  "leftEye": "color name",
  "rightEye": "color name",
  "noseMouthNails": "color name",
  "randomLineColor": "color name or null",
  "tabbyStripeColor": "color name or null"
}

Color Rules:
- Return JSON only, no other text
- Don't default to white unless the cat is explicitly white
- Use breed-appropriate colors
- Tabby, American short hair, English short hair, Australian Mist, Bengal, Serengeti, Savannah, Egyptian Mau, Arabian Mau, Maine Coon, and Ocicat: include tabbyStripeColor by default
- Apply tabbyStripeColor if mention terms: strip, spot, blotch
- Eye/nose/nail colors (leftEye, rightEye, noseMouthNails) don't count toward color limit

Body Color Limits (excluding eyes/nose/nails):
- CALICO cats: Can use 3+ colors (e.g., orange + black + white patches)
- All other cats: Limit body/face/chest/legs/tail to MAX 2 different colors
  * Example: "orange tabby" = orange body + chocolate stripes (2 colors)
  * Example: "grey and white cat" = grey body + white chest (2 colors)
  * Example: "calico" = orange + black + white (3 colors OK for calicos only)
- Inner face (innerface) can be different from outer face but counts toward the 2-color limit

When to use innerface:
- Use innerface for two-toned face patterns (e.g., colorpoint, white muzzle, nose patch)
- Examples that SHOULD have innerface:
  * "Siamese cat" → face: chocolate, innerface: white (or lighter)
  * "cat with white nose" → face: orange, innerface: white
  * "tabby with white muzzle" → face: brown, innerface: white
  * "Burmese" → face: chocolate, innerface: darker shade (black or darkgrey)
- Set innerface to the same color as the face only if the entire face is uniform color

Distribution Examples:
- Solid cat: all body parts same color (1 color used)
- Colorpoint/Siamese: light body + dark points, face has darker innerface
- Bicolor/Patched: two-toned distribution (2 colors used)
- Calico: explicitly 3 colors allowed`;

  const payload = {
    version: GPT_5_NANO_VERSION,
    input: { prompt: fullPrompt, max_tokens: 256 },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const response = await fetch(REPLICATE_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`LLM request failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    let outputText = data.output && typeof data.output === "string" ? data.output :
                     data.output && Array.isArray(data.output) ? data.output.join("") : data.text || data;

    if (!outputText) {
      console.warn("No output text in LLM response");
      return null;
    }

    let colorSuggestions = null;
    try {
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        colorSuggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseErr) {
      console.warn("Failed to parse LLM JSON:", parseErr);
      return null;
    }

    if (!colorSuggestions) {
      console.warn("No color suggestions from LLM");
      return null;
    }

    return {
      face: findClosestPaletteColor(colorSuggestions.face || "white"),
      body: findClosestPaletteColor(colorSuggestions.body || "white"),
      chest: findClosestPaletteColor(colorSuggestions.chest || "white"),
      frontLeftLeg: findClosestPaletteColor(colorSuggestions.frontLeftLeg || "white"),
      frontRightLeg: findClosestPaletteColor(colorSuggestions.frontRightLeg || "white"),
      backLeftLeg: findClosestPaletteColor(colorSuggestions.backLeftLeg || "white"),
      backRightLeg: findClosestPaletteColor(colorSuggestions.backRightLeg || "white"),
      tail: findClosestPaletteColor(colorSuggestions.tail || "white"),
      leftEye: findClosestPaletteColor(colorSuggestions.leftEye || "blue"),
      rightEye: findClosestPaletteColor(colorSuggestions.rightEye || "blue"),
      noseMouthNails: findClosestPaletteColor(colorSuggestions.noseMouthNails || "pink"),
      innerface: colorSuggestions.innerface ? findClosestPaletteColor(colorSuggestions.innerface) : null,
      randomLineColor: colorSuggestions.randomLineColor ? findClosestPaletteColor(colorSuggestions.randomLineColor) : null,
      tabbyStripeColor: colorSuggestions.tabbyStripeColor ? findClosestPaletteColor(colorSuggestions.tabbyStripeColor) : null,
    };
  } catch (err) {
    console.warn("LLM request error:", err.message || err);
    return null;
  }
}

function applyColorOverridesToCat(colorMap, catDescription) {
  try {
    console.log("Applying color overrides:", colorMap);
    
    const headOverrides = {
      _default: colorMap.face,
      eyeL: colorMap.leftEye,
      eyeR: colorMap.rightEye,
      nose: colorMap.noseMouthNails,
    };
    
    // Only add innerface if it's defined and not null
    if (colorMap.innerface) {
      headOverrides.innerface = colorMap.innerface;
      console.log("Setting innerface color:", colorMap.innerface);
    }
    
    window.PALETTE_REGION_OVERRIDES = {
      head: headOverrides,
      body: {
        _default: colorMap.body,
        chest: colorMap.chest,
        nail: colorMap.noseMouthNails,
      },
      tail: {
        _default: colorMap.tail,
      },
    };

    if (colorMap.randomLineColor) {
      window.LINE_COLOR_OVERRIDE = colorMap.randomLineColor;
    }

    if (typeof window.redrawCat === "function") {
      window.redrawCat();
    }
  } catch (err) {
    console.warn("Error applying colors:", err);
  }
}

window.applyColorsFromDescription = async function (description) {
  const finishBtn = document.getElementById("finishButton");
  if (finishBtn) {
    finishBtn.disabled = true;
    finishBtn.textContent = "Loading...";
  }

  try {
    const colorSuggestions = await requestColorSuggestionsFromLLM(description);
    if (colorSuggestions) {
      console.log("Color suggestions:", colorSuggestions);
      applyColorOverridesToCat(colorSuggestions, description);
    } else {
      console.warn("No color suggestions from LLM");
    }
  } catch (err) {
    console.warn("Pipeline error:", err);
  } finally {
    if (finishBtn) {
      finishBtn.disabled = false;
      finishBtn.textContent = "draw";
    }
  }
};

function wireUpLLMPipeline() {
  const finishBtn = document.getElementById("finishButton");
  const textarea = document.getElementById("colorToggleInput");

  if (!finishBtn || !textarea) {
    console.warn("Finish button or textarea not found");
    return;
  }

  const newFinishBtn = finishBtn.cloneNode(true);
  finishBtn.parentNode.replaceChild(newFinishBtn, finishBtn);

  newFinishBtn.addEventListener("click", async function () {
    const description = textarea.value.trim();
    if (description.length > 0) {
      await window.applyColorsFromDescription(description);
    }
  });

  textarea.addEventListener("keypress", async function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const description = textarea.value.trim();
      if (description.length > 0) {
        await window.applyColorsFromDescription(description);
      }
    }
  });

  console.log("LLM pipeline ready");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wireUpLLMPipeline);
} else {
  wireUpLLMPipeline();
}
