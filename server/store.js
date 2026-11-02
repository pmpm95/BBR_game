// 아주 단순한 JSON 파일 저장소 (참가자 11명 규모라 DB 없이 충분)
import fs from 'node:fs';
import path from 'node:path';

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.playersPath = path.join(dataDir, 'players.json');
    this.dbPath = path.join(dataDir, 'db.json');
    this.players = [];
    this.db = { attempts: [], tokens: {}, frozen: false };
  }

  load() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.playersPath)) {
      throw new Error(
        `참가자 파일이 없습니다: ${this.playersPath}\n` +
          '먼저 `npm run gen-codes -- 이름1 이름2 ...` 로 참가자 코드를 생성하세요.',
      );
    }
    this.players = JSON.parse(fs.readFileSync(this.playersPath, 'utf8'));
    const codes = new Set();
    for (const p of this.players) {
      if (!p.id || !p.name || !/^\d{4}$/.test(String(p.code))) {
        throw new Error(`players.json 형식 오류: ${JSON.stringify(p)}`);
      }
      if (codes.has(String(p.code))) throw new Error(`중복 코드: ${p.code}`);
      codes.add(String(p.code));
    }
    if (fs.existsSync(this.dbPath)) {
      this.db = { ...this.db, ...JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) };
    }
  }

  save() {
    const tmp = `${this.dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.dbPath);
  }

  playerById(id) {
    return this.players.find((p) => p.id === id);
  }

  playerByCode(code) {
    return this.players.find((p) => String(p.code) === String(code));
  }
}
