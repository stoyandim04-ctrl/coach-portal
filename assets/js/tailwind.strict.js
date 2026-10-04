/*
 * Strict Tailwind (Play CDN) theme generated from design-tokens.js.
 * It REPLACES the default colors, fonts, type scale, spacing and radii,
 * so any value outside DESIGN.md simply doesn't exist as a class.
 */
(() => {
  const t = window.CoachPortalDesign;
  tailwind.config = {
    theme: {
      colors: { transparent: 'transparent', current: 'currentColor', black: '#000', white: '#fff', ...t.colors },
      fontFamily: t.fontFamily,
      fontSize: t.fontSize,
      fontWeight: t.fontWeight,
      spacing: t.spacing,
      borderRadius: t.borderRadius,
      extend: {
        width: t.sizes,
        height: t.sizes,
        size: t.sizes,
        minHeight: t.sizes,
        boxShadow: t.boxShadow,
      },
    },
  };
})();
