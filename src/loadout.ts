// 저장 데이터에서 영웅 한 명의 지금 모습·능력치를 꺼낸다 (로비와 전투가 같이 쓴다)
import { gradeMul, HEROES, heroMul, lookOf, power } from './data';
import { addBonus, bonusOf, equippedLook, EQUIP_SLOTS, type Item } from './items';
import { membersOf, type FactionId } from './tactics';
import { passiveBonus, spentOf, talentBonus } from './talents';
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
  const bonus = addBonus(addBonus(bonusOf(items), talentBonus(heroId, h)), passiveBonus(heroId, h.grade));
  const base = power(def, h.level, h.grade);
  return {
    def, grade: g, level: h.level, bonus, policy: save.policy?.[heroId] ?? 'attack',
    mul: heroMul(h.level) * gradeMul(h.grade),
    look: equippedLook(lookOf(def, g)!, h.equip ?? {}, save.items ?? []),
    title: def.titles?.[g],
    // 특성은 포인트마다 기본 전투력 1.5%, 장비 고유 효과·4세트는 하나에 5% 로 친다 (규칙을 바꾸는 효과는 수치로 재기 어렵다)
    power: base + Math.round(base * 0.015 * spentOf(h) + base * 0.05 * (Object.keys(bonus.uniq).length + bonus.caps.filter(c => c.startsWith('set_')).length) + bonus.atk * 2 + bonus.hp * 0.1 + bonus.def * 1.5 + bonus.crit * 300 + bonus.critDmg * 100 + bonus.spd * 2 + bonus.atkPct * 400),
  };
}

/** 모의전 AI 영웅: 장비·특성 없이 레벨·등급만 */
export function aiLoadout(heroId: string, level: number, grade: number) {
  const def = HEROES.find(h => h.id === heroId)!;
  const g = Math.min(grade, def.maxGrade ?? 2);
  return {
    def, grade: g, level, bonus: passiveBonus(heroId, g), policy: 'attack' as const,
    mul: heroMul(level) * gradeMul(g), look: lookOf(def, g)!, title: def.titles?.[g], power: power(def, level, g),
  };
}

/** 모의전 상대: 'b' = 내 파티 B, 진영 id = 그 진영 4명 (내 파티 평균 레벨·등급 + off 레벨) */
export function rivalParty(save: SaveData, team: string, off = 0) {
  if (team === 'b') return (save.party2 ?? []).filter(id => save.heroes[id]).map(id => loadout(save, id));
  const mine = save.party.map(id => save.heroes[id]);
  const lv = Math.max(1, Math.round(mine.reduce((a, h) => a + h.level, 0) / mine.length) + off);
  const g = Math.round(mine.reduce((a, h) => a + h.grade, 0) / mine.length);
  return membersOf(team as FactionId).map(id => aiLoadout(id, lv, g));
}

/** 이 아이템을 낀 영웅 id (없으면 undefined) */
export function wearerOf(save: SaveData, uid: number) {
  return Object.entries(save.heroes).find(([, h]) => Object.values(h.equip ?? {}).includes(uid))?.[0];
}
