/**
 * Color palette for the cat drawing application.
 * Defines named colors used throughout the drawing system.
 */

const PALETTE = {
  white: "#ffffff",
  black: "#3A3226",
  orange: "#DCB879",
  brown: "#B8AC98",
  purple: "#BBABAB",
  pink: "#E69871",
  green: "#70732D",
  mustaurd:"#A99980",
  blue: "#ADCBF1",
  yellow: "#E9CD4C",
  chocolate: "#928178",
  amber: "#B87333",
  red:"#7D3F21",
  grey: "#BDC0BA",
  darkgrey: "#78756C",
};

// Expose globally for all scripts to use
window.PALETTE = PALETTE;

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PALETTE;
}
