// 저장 데이터에서 영웅 한 명의 지금 모습·능력치를 꺼낸다 (로비와 전투가 같이 쓴다)
import { gradeMul, HEROES, heroMul, lookOf, power } from './data';
import { bonusOf, equippedLook, EQUIP_SLOTS, type Item } from './items';
import type { SaveData } from './save';

export function equippedItems(save: SaveData, heroId: string): Item[] {
  const eq = save.heroes[heroId].equip ?? {};
  return EQUIP_SLOTS.map(s => eq[s]).filter((u): u is number => u !== undefined)
    .map(u => save.items?.find(i => i.uid === u)).filter((i): i is Item => !!i);
}

/** grade 를 주면 그 등급 외형으로 (영웅 탭 미리보기) */
export function loadout(save: SaveData, heroId: string, grade?: number) {
  const def = HEROES.find(h => h.id === heroId)!;
  const h = save.heroes[heroId];
  const g = grade ?? h.grade;
  const items = equippedItems(save, heroId);
  const bonus = bonusOf(items);
  return {
    def, grade: g, level: h.level, bonus,
    mul: heroMul(h.level) * gradeMul(h.grade),
    look: equippedLook(lookOf(def, g)!, h.equip ?? {}, save.items ?? []),
    title: def.titles?.[g],
    power: power(def, h.level, h.grade) + Math.round(bonus.atk * 2 + bonus.hp * 0.1 + bonus.def * 1.5 + bonus.crit * 300 + bonus.critDmg * 100 + bonus.spd * 2 + bonus.atkPct * 400),
  };
}

/** 이 아이템을 낀 영웅 id (없으면 undefined) */
export function wearerOf(save: SaveData, uid: number) {
  return Object.entries(save.heroes).find(([, h]) => Object.values(h.equip ?? {}).includes(uid))?.[0];
}
