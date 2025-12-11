/**
 * Color palette for the cat drawing application.
 * Defines named colors used throughout the drawing system.
 */

const PALETTE = {
  white: "#ffffff",
  black: "#3A3226",
  orange: "#DCB879",
  lightBrown: "#B4A582",
  lightGrey: "#B19693",
  pink: "#DB8E71",
  green: "#838A2D",
  blue: "#69B0AC",
  khaki: "#7D6C46",
  brown: "#9B6E23",
  grey: "#BDC0BA",
  yellow:"#E9CD4C",
};

// Expose globally for all scripts to use
window.PALETTE = PALETTE;

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PALETTE;
}
