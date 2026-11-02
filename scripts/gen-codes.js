// 참가자별 4자리 개인 코드 생성
//   npm run gen-codes -- 홍길동 김철수 이영희 ...
//   npm run gen-codes -- --file data/names.txt      (한 줄에 한 명)
//   --force : 기존 data/players.json 덮어쓰기
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR || path.join(ROOT, 'data');
const out = path.join(dataDir, 'players.json');

const args = process.argv.slice(2);
const force = args.includes('--force');
let names = args.filter((a) => !a.startsWith('--'));
const fileIdx = args.indexOf('--file');
if (fileIdx >= 0) {
  const file = args[fileIdx + 1];
  names = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}
names = [...new Set(names.map((s) => s.trim()).filter(Boolean))];

if (!names.length) {
  console.error('사용법: npm run gen-codes -- 이름1 이름2 ...  또는  --file names.txt');
  process.exit(1);
}
if (fs.existsSync(out) && !force) {
  console.error(`${out} 가 이미 있습니다. 다시 만들려면 --force 를 붙이세요. (기존 코드는 무효화됩니다)`);
  process.exit(1);
}

const weak = new Set(['0000', '1111', '1234', '1111', '4321', '1004', '2580']);
const used = new Set();
const players = names.map((name, i) => {
  let code;
  do {
    code = String(crypto.randomInt(10000)).padStart(4, '0');
  } while (used.has(code) || weak.has(code) || /^(\d)\1{3}$/.test(code));
  used.add(code);
  return { id: `p${String(i + 1).padStart(2, '0')}`, name, code };
});

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(out, JSON.stringify(players, null, 2));
console.log(`✅ ${players.length}명 코드 생성 → ${out}\n`);
console.log('이름\t코드  (각자에게 개별로만 전달하세요)');
for (const p of players) console.log(`${p.name}\t${p.code}`);
