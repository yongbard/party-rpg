// 기기 안 저장 (localStorage). 서버 없음.
import { HEROES } from './data';
import { rollItem, type EquipSlot, type Item } from './items';

export interface SaveData {
  v: 1;
  gold: number;
  gems: number;
  heroes: Record<string, { level: number; grade: number; equip?: Partial<Record<EquipSlot, number>> }>;   // 가진 영웅만
  shards?: Record<string, number>;                  // 영웅 조각 (중복 소환)
  pity?: { hero: number; hero5: number; gear: number };   // 천장 카운터 (전설+, 신화+, 장비 전설+)
  items?: Item[];           // 가방
  nextUid?: number;
  party: string[];          // 진형 순서: 앞줄 왼쪽, 앞줄 오른쪽, 뒷줄 왼쪽, 뒷줄 오른쪽
  cleared: string[];        // 클리어한 스테이지 id
  auto?: boolean;           // 필살기 자동 사용
}

const KEY = 'party-rpg-save';
/** 처음부터 가진 영웅. 나머지는 소환으로 얻는다 */
const STARTERS = ['leon', 'bran', 'sera', 'kyle'];
const START_GEMS = 3000;   // 뽑기를 바로 해 볼 수 있게 (10연 2번)

/** 시작 장비: 낮은 등급 아이템 몇 개 (뽑기가 생기기 전까지 장비를 써 볼 수 있게) */
function giveStarter(s: SaveData) {
  s.items = [];
  s.nextUid = 1;
  const add = (grade: number, slot?: Parameters<typeof rollItem>[2]) => s.items!.push(rollItem(s.nextUid!++, grade, slot));
  (['weapon', 'weapon', 'weapon', 'offhand', 'helmet', 'cloak', 'armor', 'acc'] as const).forEach((slot, i) => add(i < 4 ? 0 : 1, slot));
}

export function addItem(s: SaveData, item: Omit<Item, 'uid'>) {
  s.nextUid ??= 1;
  const it = { ...item, uid: s.nextUid++ } as Item;
  (s.items ??= []).push(it);
  return it;
}

function fresh(): SaveData {
  return upgrade({
    v: 1,
    gold: 0,
    gems: 0,
    heroes: {},
    party: [...STARTERS],
    cleared: [],
  });
}

/** 예전 저장에 새 항목을 채운다 */
function upgrade(s: SaveData) {
  // 등급이 생기기 전 저장: 처음 등급으로 채운다
  for (const h of HEROES.filter(h => STARTERS.includes(h.id))) {
    s.heroes[h.id] ??= { level: 1, grade: h.startGrade ?? 2 };
    s.heroes[h.id].grade ??= h.startGrade ?? 2;
  }
  if (!s.items) giveStarter(s);
  if (!s.pity) {
    s.pity = { hero: 0, hero5: 0, gear: 0 };
    s.gems += START_GEMS;
  }
  return s;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as SaveData;
      if (s.v === 1) return upgrade(s);
    }
  } catch (e) {
    console.warn('저장 데이터를 읽지 못했습니다. 새로 시작합니다.', e);
  }
  return fresh();
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('저장 실패', e);
  }
}
