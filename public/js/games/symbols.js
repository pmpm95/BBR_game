// 빼빼로데이 테마 카드 그림 18종 (viewBox 0 0 100 100)
// 실루엣과 대표 색이 모두 달라서 한눈에 구분되도록 구성
const stick = (coat, extra = '') =>
  `<rect x="44" y="6" width="12" height="88" rx="6" fill="#e9bf78"/>` +
  `<rect x="43" y="6" width="14" height="62" rx="7" fill="${coat}"/>${extra}`;

export const SYMBOLS = [
  {
    name: '초코 빼빼로',
    svg:
      '<g transform="rotate(35 50 50)">' +
      '<rect x="42" y="4" width="16" height="92" rx="8" fill="#e9bf78"/>' +
      '<rect x="41" y="4" width="18" height="66" rx="9" fill="#5a321a"/>' +
      '<rect x="45" y="10" width="3.5" height="52" rx="1.75" fill="#8a5a36"/></g>',
  },
  {
    name: '녹차 빼빼로',
    svg:
      `<g transform="rotate(-24 50 50)">${stick('#7cb342', '<circle cx="50" cy="20" r="2" fill="#f1f8e9"/><circle cx="50" cy="40" r="2" fill="#f1f8e9"/>')}</g>` +
      `<g transform="rotate(24 50 50)">${stick('#689f38', '<circle cx="50" cy="30" r="2" fill="#f1f8e9"/><circle cx="50" cy="50" r="2" fill="#f1f8e9"/>')}</g>`,
  },
  {
    name: '빼빼로 상자',
    svg:
      '<rect x="30" y="8" width="9" height="36" rx="4.5" fill="#5a321a"/>' +
      '<rect x="45" y="4" width="9" height="40" rx="4.5" fill="#5a321a"/>' +
      '<rect x="60" y="10" width="9" height="34" rx="4.5" fill="#5a321a"/>' +
      '<rect x="22" y="34" width="56" height="60" rx="6" fill="#d32f2f"/>' +
      '<rect x="22" y="34" width="56" height="11" rx="4" fill="#b71c1c"/>' +
      '<path d="M50 84 C38 75 32 68 34 61 C36 54 46 54 50 61 C54 54 64 54 66 61 C68 68 62 75 50 84Z" fill="#fff"/>',
  },
  {
    name: '하트',
    svg:
      '<path d="M50 88 C18 66 6 46 12 29 C18 12 42 10 50 30 C58 10 82 12 88 29 C94 46 82 66 50 88Z" fill="#ec407a"/>' +
      '<ellipse cx="30" cy="32" rx="7" ry="11" transform="rotate(-30 30 32)" fill="#fff" opacity=".45"/>',
  },
  {
    name: '선물 상자',
    svg:
      '<path d="M50 32 C38 8 18 16 28 32Z M50 32 C62 8 82 16 72 32Z" fill="#ffd54f" stroke="#f9a825" stroke-width="2"/>' +
      '<rect x="14" y="44" width="72" height="48" rx="5" fill="#1e88e5"/>' +
      '<rect x="10" y="30" width="80" height="17" rx="4" fill="#1565c0"/>' +
      '<rect x="44" y="30" width="12" height="62" fill="#ffd54f"/>',
  },
  {
    name: '리본',
    svg:
      '<path d="M46 56 L30 94 L40 89 L46 97 L54 58Z M54 56 L70 94 L60 89 L54 97 L46 58Z" fill="#6a1b9a"/>' +
      '<path d="M50 48 L14 22 C7 18 4 24 4 32 L4 66 C4 74 8 78 14 74Z" fill="#8e24aa"/>' +
      '<path d="M50 48 L86 22 C93 18 96 24 96 32 L96 66 C96 74 92 78 86 74Z" fill="#8e24aa"/>' +
      '<circle cx="50" cy="48" r="11" fill="#6a1b9a"/>',
  },
  {
    name: '러브레터',
    svg:
      '<rect x="8" y="22" width="84" height="58" rx="6" fill="#fff3c4" stroke="#c99b63" stroke-width="3"/>' +
      '<path d="M10 25 L50 56 L90 25" fill="none" stroke="#c99b63" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M50 70 C41 63 37 58 39 52 C41 46 48 46 50 52 C52 46 59 46 61 52 C63 58 59 63 50 70Z" fill="#e53935"/>',
  },
  {
    name: '사탕',
    svg:
      '<polygon points="30,50 6,30 12,50 6,70" fill="#ffcc80"/>' +
      '<polygon points="70,50 94,30 88,50 94,70" fill="#ffcc80"/>' +
      '<ellipse cx="50" cy="50" rx="25" ry="21" fill="#fb8c00"/>' +
      '<path d="M40 34 L46 66 M54 32 L60 66" stroke="#fff3e0" stroke-width="4.5" stroke-linecap="round" opacity=".85"/>',
  },
  {
    name: '막대사탕',
    svg:
      '<rect x="46.5" y="58" width="7" height="38" rx="3.5" fill="#bcaaa4"/>' +
      '<circle cx="50" cy="38" r="33" fill="#e53935"/>' +
      '<circle cx="50" cy="38" r="25" fill="#fdd835"/>' +
      '<circle cx="50" cy="38" r="17" fill="#43a047"/>' +
      '<circle cx="50" cy="38" r="9" fill="#1e88e5"/>',
  },
  {
    name: '쿠키',
    svg:
      '<circle cx="50" cy="50" r="41" fill="#d7a25e" stroke="#b9823f" stroke-width="4"/>' +
      '<g fill="#4e2a12"><circle cx="35" cy="33" r="5.5"/><circle cx="62" cy="29" r="5"/><circle cx="29" cy="58" r="5"/>' +
      '<circle cx="53" cy="51" r="6"/><circle cx="70" cy="63" r="5.5"/><circle cx="45" cy="74" r="5"/><circle cx="72" cy="43" r="4"/></g>',
  },
  {
    name: '컵케이크',
    svg:
      '<polygon points="22,56 78,56 70,95 30,95" fill="#4fc3f7"/>' +
      '<path d="M38 58 L40 93 M50 58 V93 M62 58 L60 93" stroke="#0288d1" stroke-width="3"/>' +
      '<path d="M16 60 C9 46 22 38 31 40 C31 24 47 20 54 28 C62 18 80 26 76 40 C86 40 92 52 84 60Z" fill="#f8bbd0"/>' +
      '<circle cx="53" cy="17" r="8" fill="#e53935"/>' +
      '<path d="M53 10 Q56 2 63 2" stroke="#558b2f" stroke-width="2.5" fill="none"/>',
  },
  {
    name: '도넛',
    svg:
      '<circle cx="50" cy="50" r="42" fill="#c8915a"/>' +
      '<path d="M50 12 C62 12 70 16 78 22 C86 30 90 40 88 52 C90 62 84 72 76 78 C68 86 56 90 46 88 C36 90 24 84 18 76 C12 68 10 58 12 48 C12 36 18 26 26 20 C33 15 41 12 50 12Z" fill="#4db6ac"/>' +
      '<circle cx="50" cy="50" r="14" fill="#c8915a"/><circle cx="50" cy="50" r="10" fill="#fff"/>' +
      '<g stroke-width="3.5" stroke-linecap="round"><path d="M30 30 l5 3" stroke="#fff176"/><path d="M66 26 l-3 5" stroke="#f48fb1"/>' +
      '<path d="M74 52 l4 4" stroke="#fff"/><path d="M58 74 l5 -2" stroke="#fff176"/><path d="M30 66 l2 5" stroke="#f48fb1"/><path d="M24 46 l5 -2" stroke="#fff"/></g>',
  },
  {
    name: '장미',
    svg:
      '<path d="M50 58 C47 72 48 84 50 97" stroke="#2e7d32" stroke-width="5" fill="none"/>' +
      '<path d="M50 80 C60 66 76 68 80 72 C70 82 58 84 50 80Z" fill="#43a047"/>' +
      '<path d="M50 74 C42 64 28 64 22 68 C30 78 42 80 50 74Z" fill="#43a047"/>' +
      '<path d="M22 34 C20 14 38 4 50 13 C62 4 80 14 78 34 C78 52 64 61 50 61 C36 61 22 52 22 34Z" fill="#c62828"/>' +
      '<path d="M50 40 C40 40 38 28 46 24 C54 20 62 28 58 36" fill="none" stroke="#8e0000" stroke-width="3.5" stroke-linecap="round"/>',
  },
  {
    name: '풍선',
    svg:
      '<path d="M50 72 C50 82 42 86 47 97" stroke="#5c6bc0" stroke-width="2.5" fill="none"/>' +
      '<ellipse cx="50" cy="38" rx="29" ry="34" fill="#3949ab"/>' +
      '<polygon points="44,76 56,76 50,69" fill="#3949ab"/>' +
      '<ellipse cx="39" cy="25" rx="6" ry="11" transform="rotate(20 39 25)" fill="#fff" opacity=".35"/>',
  },
  {
    name: '별',
    svg:
      '<polygon points="50,5 61,37 95,37 68,57 78,91 50,71 22,91 32,57 5,37 39,37" fill="#ffc107" stroke="#ffa000" stroke-width="3" stroke-linejoin="round"/>',
  },
  {
    name: '아이스크림',
    svg:
      '<polygon points="28,50 72,50 50,97" fill="#e0a458"/>' +
      '<path d="M36 62 H64 M42 76 H58" stroke="#b9823f" stroke-width="3"/>' +
      '<circle cx="50" cy="38" r="25" fill="#6d4c41"/>' +
      '<path d="M25 44 Q30 58 35 48 Q41 60 47 48 Q53 60 59 48 Q65 58 70 46 L75 40 L25 40Z" fill="#6d4c41"/>' +
      '<g stroke-width="3" stroke-linecap="round"><path d="M38 30 l4 2" stroke="#f48fb1"/><path d="M56 26 l-3 4" stroke="#fff176"/><path d="M60 42 l4 1" stroke="#80deea"/><path d="M42 44 l3 -3" stroke="#fff176"/></g>' +
      '<circle cx="50" cy="12" r="7" fill="#e53935"/>',
  },
  {
    name: '마카롱',
    svg:
      '<ellipse cx="50" cy="66" rx="40" ry="19" fill="#9575cd"/>' +
      '<rect x="12" y="46" width="76" height="14" rx="7" fill="#fffde7"/>' +
      '<ellipse cx="50" cy="34" rx="40" ry="19" fill="#b39ddb"/>' +
      '<ellipse cx="38" cy="27" rx="12" ry="5" fill="#fff" opacity=".35"/>',
  },
  {
    name: '11.11 달력',
    svg:
      '<rect x="12" y="16" width="76" height="76" rx="8" fill="#fff" stroke="#bdbdbd" stroke-width="3"/>' +
      '<path d="M12 24 a8 8 0 0 1 8 -8 h60 a8 8 0 0 1 8 8 v14 h-76z" fill="#e53935"/>' +
      '<rect x="28" y="7" width="7" height="17" rx="3.5" fill="#616161"/><rect x="65" y="7" width="7" height="17" rx="3.5" fill="#616161"/>' +
      '<text x="50" y="76" text-anchor="middle" font-size="27" font-weight="900" fill="#3e2723" font-family="system-ui, sans-serif">11.11</text>',
  },
];

export function symbolSvg(id) {
  const s = SYMBOLS[id];
  return `<svg viewBox="0 0 100 100" aria-label="${s.name}" role="img">${s.svg}</svg>`;
}
