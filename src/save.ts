// 기기 안 저장 (localStorage). 서버 없음.
import { HEROES } from './data';

export interface SaveData {
  v: 1;
  gold: number;
  gems: number;
  heroes: Record<string, { level: number }>;
  party: string[];          // 진형 순서: 앞줄 왼쪽, 앞줄 오른쪽, 뒷줄 왼쪽, 뒷줄 오른쪽
  cleared: string[];        // 클리어한 스테이지 id
  auto?: boolean;           // 필살기 자동 사용
}

const KEY = 'party-rpg-save';

function fresh(): SaveData {
  return {
    v: 1,
    gold: 0,
    gems: 0,
    heroes: Object.fromEntries(HEROES.map(h => [h.id, { level: 1 }])),
    party: HEROES.map(h => h.id),
    cleared: [],
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as SaveData;
      if (s.v === 1) return s;
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
