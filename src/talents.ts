// 특성 트리와 별(승급). design.md 3.2, 정한 값은 docs/content-design.md 4.5
// 영웅마다 가지 3개(첫째가 설계 의도). 가지 = 능력치 노드 4개(각 3단계) + 끝 노드 1개(규칙을 바꾼다)
import { zeroBonus, type Bonus } from './items';
import type { SaveData } from './save';

type NumKey = Exclude<keyof Bonus, 'caps'>;
export interface TNode { name: string; stat: NumKey; per: number }
export interface Branch { id: string; name: string; desc: string; nodes: TNode[]; cap: { id: string; name: string; desc: string } }

const n = (name: string, stat: NumKey, per: number): TNode => ({ name, stat, per });
export const BRANCHES: Record<string, Branch> = {
  guard: { id: 'guard', name: '수호', desc: '맞으며 버틴다', nodes: [n('강인함', 'hpPct', 0.04), n('단단한 피부', 'defPct', 0.06), n('도발의 기세', 'threatPct', 0.15), n('버티기', 'drPct', 0.02)],
    cap: { id: 'unbroken', name: '불굴', desc: '처음으로 HP 30% 아래가 되면 5초간 받는 피해 50% 감소, 최대 HP 20% 보호막' } },
  fury: { id: 'fury', name: '격노', desc: '공격과 치명', nodes: [n('힘', 'atkPct', 0.04), n('날카로움', 'crit', 0.03), n('급소', 'critDmg', 0.1), n('몰아치기', 'spd', 4)],
    cap: { id: 'berserk', name: '광전사', desc: '잃은 HP 비율만큼 공격력 증가 (최대 +60%)' } },
  drain: { id: 'drain', name: '흡수', desc: '때리며 회복한다', nodes: [n('흡혈', 'lifesteal', 0.03), n('생명력', 'hpPct', 0.03), n('굶주림', 'atkPct', 0.03), n('되살림', 'healPct', 0.05)],
    cap: { id: 'thirst', name: '피의 갈증', desc: '적을 쓰러뜨리면 최대 HP 15% 회복' } },
  mend: { id: 'mend', name: '치유', desc: '치유량과 생존', nodes: [n('치유 손길', 'healPct', 0.06), n('생명력', 'hpPct', 0.03), n('빠른 기도', 'cdr', 0.03), n('보호의 옷', 'defPct', 0.04)],
    cap: { id: 'overflow', name: '넘치는 생명', desc: '넘친 치유량의 50%가 보호막이 된다' } },
  swift: { id: 'swift', name: '신속', desc: '빠르게 자주', nodes: [n('날렵함', 'spd', 5), n('숙련', 'cdr', 0.04), n('눈썰미', 'crit', 0.02), n('기세', 'gaugePct', 0.05)],
    cap: { id: 'chain', name: '연속 기술', desc: '스킬을 쓰면 25% 확률로 그 스킬을 바로 다시 쓸 수 있다' } },
  focus: { id: 'focus', name: '집중', desc: '치명타와 마무리', nodes: [n('눈썰미', 'crit', 0.03), n('급소', 'critDmg', 0.12), n('힘', 'atkPct', 0.03), n('호흡', 'spd', 3)],
    cap: { id: 'execute', name: '처형', desc: 'HP 30% 아래 적에게 주는 피해 +40%' } },
  shadow: { id: 'shadow', name: '그림자', desc: '노려지지 않고 찌른다', nodes: [n('숨죽임', 'threatPct', -0.12), n('눈썰미', 'crit', 0.03), n('날렵함', 'spd', 4), n('힘', 'atkPct', 0.03)],
    cap: { id: 'stealth', name: '기습', desc: '전투 시작 때 적이 노리지 않고, 첫 공격은 반드시 치명타' } },
  sweep: { id: 'sweep', name: '휩쓸기', desc: '여럿을 함께 친다', nodes: [n('힘', 'atkPct', 0.03), n('생명력', 'hpPct', 0.03), n('단단한 피부', 'defPct', 0.04), n('급소', 'critDmg', 0.08)],
    cap: { id: 'cleave', name: '파편', desc: '기본 공격이 대상 주변 적에게도 30% 피해' } },
  bond: { id: 'bond', name: '결속', desc: '파티를 돕는다', nodes: [n('공명', 'gaugePct', 0.06), n('치유 손길', 'healPct', 0.04), n('보호의 옷', 'defPct', 0.04), n('생명력', 'hpPct', 0.03)],
    cap: { id: 'inspire', name: '고무', desc: '필살기를 쓰면 아군 전체 공격력 +15% (6초)' } },
  element: { id: 'element', name: '원소', desc: '스킬과 필살기', nodes: [n('마력', 'atkPct', 0.04), n('빠른 영창', 'cdr', 0.03), n('눈썰미', 'crit', 0.02), n('공명', 'gaugePct', 0.04)],
    cap: { id: 'embers', name: '잔불', desc: '스킬을 쓰면 대상이 3초간 불탄다 (공격력 15%씩)' } },
  thorns: { id: 'thorns', name: '반격', desc: '때린 만큼 돌려준다', nodes: [n('단단한 피부', 'defPct', 0.06), n('생명력', 'hpPct', 0.04), n('버티기', 'drPct', 0.02), n('도발의 기세', 'threatPct', 0.1)],
    cap: { id: 'thorns', name: '가시', desc: '근접 공격을 받으면 받은 피해의 20%를 되돌린다' } },
};

/** 영웅별 가지 3개. 첫째가 설계 의도를 강화하고, 둘째·셋째는 다른 쪽으로 끌어 간다 */
export const HERO_BRANCHES: Record<string, [string, string, string]> = {
  leon: ['guard', 'fury', 'drain'], bran: ['fury', 'focus', 'thorns'], sera: ['mend', 'element', 'bond'], kyle: ['focus', 'swift', 'shadow'],
  dorin: ['guard', 'thorns', 'bond'], mia: ['mend', 'bond', 'element'], pug: ['shadow', 'focus', 'drain'],
  hagen: ['sweep', 'guard', 'fury'], lia: ['swift', 'focus', 'drain'], gorga: ['bond', 'mend', 'fury'], kix: ['element', 'sweep', 'swift'],
  jin: ['swift', 'thorns', 'drain'], nora: ['focus', 'sweep', 'guard'], ella: ['bond', 'swift', 'mend'],
  morgan: ['drain', 'element', 'shadow'], garsh: ['guard', 'fury', 'thorns'],
};

export const RANKS = 3;            // 능력치 노드 최대 단계
export const NODE_NEED = [0, 2, 4, 6, 8];   // 그 노드를 배우려면 같은 가지에 먼저 쓴 포인트
const GRADE_POINTS = [4, 5, 6, 8, 10, 12, 14, 16];
export const RESET_GOLD = 200;     // 초기화: 쓴 포인트 하나당 골드

// 별: 등급과 따로 0~5. 별마다 최대 레벨 +5, 특성 포인트 +1. 조각의 쓰임새 (최대 등급 영웅도 조각을 쓴다)
export const MAX_STARS = 5;
export const STAR_COST: [number, number][] = [[10, 2000], [20, 5000], [40, 12000], [80, 30000], [150, 80000]];   // [조각, 골드]

type HeroSave = SaveData['heroes'][string];
const ranksOf = (h: HeroSave) => h.talents ?? new Array(15).fill(0);
export const pointsOf = (h: HeroSave) => GRADE_POINTS[h.grade] + (h.stars ?? 0);
export const spentOf = (h: HeroSave) => ranksOf(h).reduce((a, b) => a + b, 0);
const branchSpent = (r: number[], b: number) => r.slice(b * 5, b * 5 + 5).reduce((a, x) => a + x, 0);

/** 배울 수 있나: 이유를 돌려주고, 되면 null */
export function canLearn(save: SaveData, heroId: string, b: number, i: number): string | null {
  const h = save.heroes[heroId];
  const r = ranksOf(h);
  if (r[b * 5 + i] >= (i === 4 ? 1 : RANKS)) return '다 배웠다';
  if (branchSpent(r, b) < NODE_NEED[i]) return `이 가지에 ${NODE_NEED[i]}포인트를 먼저 쓴다`;
  if (spentOf(h) >= pointsOf(h)) return '특성 포인트가 없다';
  return null;
}

export function learn(save: SaveData, heroId: string, b: number, i: number) {
  if (canLearn(save, heroId, b, i)) return false;
  const h = save.heroes[heroId];
  h.talents = ranksOf(h);
  h.talents[b * 5 + i]++;
  return true;
}

export function resetTalents(save: SaveData, heroId: string) {
  const h = save.heroes[heroId];
  const cost = spentOf(h) * RESET_GOLD;
  if (!cost || save.gold < cost) return false;
  save.gold -= cost;
  h.talents = undefined;
  return true;
}

/** 별 올리기: 이유를 돌려주고, 되면 null */
export function canStar(save: SaveData, heroId: string): string | null {
  const st = save.heroes[heroId].stars ?? 0;
  if (st >= MAX_STARS) return '별이 다 찼다';
  const [sh, gold] = STAR_COST[st];
  if ((save.shards?.[heroId] ?? 0) < sh) return '조각이 모자란다';
  if (save.gold < gold) return '골드가 모자란다';
  return null;
}

export function starUp(save: SaveData, heroId: string) {
  if (canStar(save, heroId)) return false;
  const h = save.heroes[heroId];
  const [sh, gold] = STAR_COST[h.stars ?? 0];
  save.shards![heroId] -= sh;
  save.gold -= gold;
  h.stars = (h.stars ?? 0) + 1;
  return true;
}

/** 배운 특성의 능력치와 끝 노드 효과 */
export function talentBonus(heroId: string, h: HeroSave): Bonus {
  const b = zeroBonus();
  const ids = HERO_BRANCHES[heroId];
  if (!ids || !h.talents) return b;
  h.talents.forEach((rank, k) => {
    if (!rank) return;
    const br = BRANCHES[ids[Math.floor(k / 5)]];
    const i = k % 5;
    if (i < 4) b[br.nodes[i].stat] += br.nodes[i].per * rank;
    else {
      b.caps.push(br.cap.id);
      if (br.cap.id === 'berserk') b.rage += 0.6;
    }
  });
  return b;
}

/** 노드 한 단계 효과를 글로 (예: 공격력 +4%) */
const LABEL: Record<NumKey, [string, boolean]> = {
  atk: ['공격력', false], hp: ['체력', false], def: ['방어력', false], crit: ['치명타', true], critDmg: ['치명 피해', true], spd: ['공격 속도', false],
  atkPct: ['공격력', true], hpPct: ['체력', true], defPct: ['방어력', true], healPct: ['치유량', true], threatPct: ['위협', true],
  drPct: ['받는 피해 감소', true], lifesteal: ['흡혈', true], cdr: ['스킬 재사용 단축', true], gaugePct: ['필살기 충전', true], rage: ['격노', true],
};
export function nodeText(t: TNode, rank = 1) {
  const [name, pct] = LABEL[t.stat];
  const v = t.per * rank;
  return `${name} ${v >= 0 ? '+' : '−'}${pct ? `${Math.round(Math.abs(v) * 100)}%` : Math.abs(v)}`;
}

export const branchesOf = (heroId: string) => (HERO_BRANCHES[heroId] ?? []).map(id => BRANCHES[id]);

// ───────── 등급 보상: 패시브, 필살기 단계, 파티 오라 (design.md 3.3) ─────────

/** 패시브가 열리는 등급: 희귀, 전설, 초월 */
export const PASSIVE_AT = [2, 4, 7];
export interface Passive { name: string; b: Partial<Omit<Bonus, 'caps'>>; cap?: string }
const P = (name: string, b: Passive['b'], cap?: string): Passive => ({ name, b, cap });
/** 영웅별 패시브 (열리는 등급 순). 최대 등급이 낮은 영웅은 앞의 것만 쓴다 */
export const PASSIVES: Record<string, Passive[]> = {
  leon: [P('기사의 긍지', { hpPct: 0.08, threatPct: 0.2 }), P('방패의 벽', { drPct: 0.06 }), P('용의 심장', { lifesteal: 0.06, hpPct: 0.1 })],
  bran: [P('북방의 피', { atkPct: 0.08 }), P('도끼 폭풍', {}, 'cleave')],
  sera: [P('마력의 샘', { healPct: 0.1 }), P('빛의 가호', {}, 'overflow')],
  kyle: [P('바람의 눈', { crit: 0.08 }), P('사냥꾼', {}, 'execute')],
  dorin: [P('성문 사수', { defPct: 0.12 })],
  mia: [P('약초 지식', { healPct: 0.12 })],
  pug: [P('날쌘 손', { spd: 10 })],
  hagen: [P('대장장이의 팔', { atkPct: 0.06, defPct: 0.05 })],
  lia: [P('엘프의 발놀림', { spd: 8, crit: 0.03 })],
  gorga: [P('전쟁 북소리', { gaugePct: 0.1 })],
  kix: [P('타오르는 피', { atkPct: 0.08 })],
  jin: [P('단련된 몸', { hpPct: 0.08, drPct: 0.03 }), P('연환', {}, 'chain')],
  nora: [P('창끝', { critDmg: 0.2 }), P('관통', {}, 'cleave')],
  ella: [P('선율', { gaugePct: 0.12 }), P('앙코르', {}, 'inspire')],
  morgan: [P('죽음의 계약', { lifesteal: 0.05 }), P('영혼 수확', {}, 'thirst')],
  garsh: [P('족장의 위엄', { hpPct: 0.1, threatPct: 0.2 }), P('피의 분노', { rage: 0.4 })],
};
/** 끝 노드 id → 설명 (패시브가 끝 노드 효과를 쓸 때) */
const CAP_DESC = Object.fromEntries(Object.values(BRANCHES).map(br => [br.cap.id, br.cap.desc]));
export function passiveText(p: Passive) {
  const parts = (Object.entries(p.b) as [NumKey, number][]).map(([k, v]) => nodeText({ name: '', stat: k, per: v }));
  if (p.cap) parts.push(CAP_DESC[p.cap]);
  return parts.join(', ');
}
export const passivesOf = (heroId: string) => (PASSIVES[heroId] ?? []).map((p, i) => ({ ...p, at: PASSIVE_AT[i] }));

/** 필살기 단계: 신화 2, 초월 3. 단계마다 필살기 피해·치유 배율 */
export const ultLevel = (grade: number) => (grade >= 7 ? 3 : grade >= 5 ? 2 : 1);
export const ULT_MUL = [1, 1.3, 1.6];
/** 파티 오라 (불멸 이상): 아군 전체 공격력 */
export const auraOf = (grade: number) => (grade >= 7 ? 0.08 : grade >= 6 ? 0.05 : 0);

/** 지금 등급까지 열린 패시브의 능력치·효과 */
export function passiveBonus(heroId: string, grade: number): Bonus {
  const b = zeroBonus();
  for (const p of passivesOf(heroId)) {
    if (grade < p.at) continue;
    for (const [k, v] of Object.entries(p.b) as [NumKey, number][]) b[k] += v;
    if (p.cap) b.caps.push(p.cap);
  }
  return b;
}
