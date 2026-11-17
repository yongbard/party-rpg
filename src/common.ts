// data.ts 와 heroes.ts 가 같이 쓰는 값 (서로 불러오지 않게 따로 둔다)
import { Color3 } from '@babylonjs/core';
import type { Unit } from './unit';

export const COL = {
  gold: new Color3(1, 0.78, 0.32),
  red: new Color3(1, 0.22, 0.12),
  green: new Color3(0.35, 1, 0.5),
  blue: new Color3(0.45, 0.72, 1),
  purple: new Color3(0.72, 0.35, 1),
  white: new Color3(1, 1, 1),
  bone: new Color3(0.95, 0.88, 0.7),
};

export const lowestHpRatio = (list: Unit[]) =>
  list.reduce<Unit | null>((m, x) => (!m || x.hp / x.maxHp < m.hp / m.maxHp ? x : m), null);

export const QS = 1.25;   // 조합형 사람 키(약 1.8)를 KayKit 적(약 2.3)과 맞춘다
