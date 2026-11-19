// 열림 표(src/unlocks.ts) 시험. 실행: node --test src/tools/test-unlocks.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpen, opened, newlyOpened, isNew, markSeen } from '../unlocks.ts';

const upTo = (ch, k) => Array.from({ length: k }, (_, i) => `${ch}-${i + 1}`);
const all = [...upTo(1, 10), ...upTo(2, 10)];

test('스테이지를 깨야 열린다', () => {
  assert.equal(isOpen([], 'hero'), false);
  assert.equal(isOpen(['1-1'], 'hero'), true);
  assert.equal(isOpen(['1-1'], 'gear'), false);
});

test('다 깨면 18개 모두 열린다', () => {
  assert.equal(opened(all).length, 18);
  assert.deepEqual(opened([]), []);
});

test('1장 보스를 깨면 던전과 강화가 같이 열린다', () => {
  const before = upTo(1, 9);
  assert.deepEqual(newlyOpened(before, [...before, '1-10']), ['dungeon', 'enhance']);
  assert.deepEqual(newlyOpened(before, before), []);
});

test('열렸고 안 본 것만 새것', () => {
  assert.equal(isNew({ cleared: ['1-1'], seen: [] }, 'hero'), true);
  assert.equal(isNew({ cleared: ['1-1'], seen: ['hero'] }, 'hero'), false);
  assert.equal(isNew({ cleared: [], seen: [] }, 'hero'), false);
  assert.equal(isNew({ cleared: ['1-1'] }, 'hero'), true);
});

test('markSeen 은 처음만 true, seen 이 없으면 만든다', () => {
  const s = {};
  assert.equal(markSeen(s, 'hero'), true);
  assert.deepEqual(s.seen, ['hero']);
  assert.equal(markSeen(s, 'hero'), false);
});
