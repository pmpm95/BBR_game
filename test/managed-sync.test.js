import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SYNCED } from '../scripts/sync-managed.js';

test('Managed Runtime 버전의 공용 파일이 원본과 같음 (다르면 npm run sync:managed)', () => {
  for (const [from, to] of SYNCED) {
    assert.equal(fs.readFileSync(to, 'utf8'), fs.readFileSync(from, 'utf8'), `${to} 가 ${from} 와 다릅니다`);
  }
});
