// 공용 파일(게임 규칙·랭킹·게임 3종·스타일)을 Managed Runtime 버전(managed-app/src)으로 복사
//   npm run sync:managed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SYNCED = [
  ['public/js/shared/rules.js', 'managed-app/src/shared/rules.js'],
  ['public/js/shared/leaderboard.js', 'managed-app/src/shared/leaderboard.js'],
  ['public/js/games/cards.js', 'managed-app/src/games/cards.js'],
  ['public/js/games/stopwatch.js', 'managed-app/src/games/stopwatch.js'],
  ['public/js/games/pepero.js', 'managed-app/src/games/pepero.js'],
  ['public/js/games/symbols.js', 'managed-app/src/games/symbols.js'],
  ['public/styles.css', 'managed-app/src/styles.css'],
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [from, to] of SYNCED) {
    fs.mkdirSync(path.dirname(path.join(ROOT, to)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, from), path.join(ROOT, to));
    console.log(`${from} → ${to}`);
  }
}
