/** Brand glyph: a 2×2 matrix where the "Do First" cell is lit — the product in one icon. */
export const BrandMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true" className="brand-mark">
    <rect width="28" height="28" rx="8" fill="var(--primary)" />
    <rect x="6.5" y="6.5" width="6.5" height="6.5" rx="2" fill="#fff" />
    <rect x="15" y="6.5" width="6.5" height="6.5" rx="2" fill="#fff" fillOpacity="0.42" />
    <rect x="6.5" y="15" width="6.5" height="6.5" rx="2" fill="#fff" fillOpacity="0.42" />
    <rect x="15" y="15" width="6.5" height="6.5" rx="2" fill="#fff" fillOpacity="0.2" />
  </svg>
);
