// 카드 그림 18종: 모양이 모두 다르고 색도 최대한 겹치지 않게 (viewBox 0 0 100 100)
export const SYMBOLS = [
  { name: '원', color: '#e53935', svg: '<circle cx="50" cy="50" r="36"/>' },
  { name: '네모', color: '#1e88e5', svg: '<rect x="16" y="16" width="68" height="68" rx="8"/>' },
  { name: '세모', color: '#43a047', svg: '<polygon points="50,10 92,86 8,86"/>' },
  {
    name: '별',
    color: '#ffa000',
    svg: '<polygon points="50,6 61,37 94,37 67,57 78,90 50,70 22,90 33,57 6,37 39,37"/>',
  },
  {
    name: '하트',
    color: '#ec407a',
    svg: '<path d="M50 88 C18 66 6 46 12 29 C18 12 42 10 50 30 C58 10 82 12 88 29 C94 46 82 66 50 88Z"/>',
  },
  { name: '다이아', color: '#8e24aa', svg: '<polygon points="50,6 88,50 50,94 12,50"/>' },
  { name: '육각형', color: '#f4511e', svg: '<polygon points="50,8 87,29 87,71 50,92 13,71 13,29"/>' },
  { name: '십자', color: '#00897b', svg: '<path d="M37 10h26v27h27v26H63v27H37V63H10V37h27z"/>' },
  {
    name: '달',
    color: '#3949ab',
    svg: '<path d="M64 10 A41 41 0 1 0 90 66 A33 33 0 1 1 64 10Z"/>',
  },
  {
    name: '번개',
    color: '#fdd835',
    svg: '<polygon points="60,4 18,56 46,56 36,96 82,40 54,40 66,4" stroke="#f9a825" stroke-width="4" stroke-linejoin="round"/>',
  },
  {
    name: '구름',
    color: '#78909c',
    svg: '<path d="M26 76 A17 17 0 0 1 24 42 A22 22 0 0 1 64 32 A20 20 0 0 1 78 76Z"/>',
  },
  {
    name: '물방울',
    color: '#00b8d4',
    svg: '<path d="M50 6 C50 6 18 46 18 63 A32 32 0 0 0 82 63 C82 46 50 6 50 6Z"/>',
  },
  {
    name: '꽃',
    color: '#d81b60',
    svg:
      '<circle cx="50" cy="26" r="17"/><circle cx="73" cy="43" r="17"/><circle cx="64" cy="70" r="17"/>' +
      '<circle cx="36" cy="70" r="17"/><circle cx="27" cy="43" r="17"/><circle cx="50" cy="50" r="11" fill="#fff59d"/>',
  },
  {
    name: '고리',
    color: '#7cb342',
    svg: '<circle cx="50" cy="50" r="30" fill="none" stroke="#7cb342" stroke-width="16"/>',
  },
  { name: '화살표', color: '#6d4c41', svg: '<polygon points="50,6 90,48 64,48 64,94 36,94 36,48 10,48"/>' },
  { name: '왕관', color: '#ff80ab', svg: '<polygon points="8,82 12,26 32,50 50,14 68,50 88,26 92,82"/>' },
  { name: '모래시계', color: '#9e9d24', svg: '<polygon points="16,8 84,8 56,50 84,92 16,92 44,50"/>' },
  { name: '집', color: '#37474f', svg: '<polygon points="50,8 92,46 78,46 78,92 22,92 22,46 8,46"/>' },
];

export function symbolSvg(id) {
  const s = SYMBOLS[id];
  return `<svg viewBox="0 0 100 100" fill="${s.color}" aria-label="${s.name}" role="img">${s.svg}</svg>`;
}
