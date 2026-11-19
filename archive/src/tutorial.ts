// 튜토리얼: 처음 한 번만 뜨는 안내. 가리킬 곳만 밝히고 말풍선을 띄운다. 누르면 닫힌다
import { writeSave, type SaveData } from './save';

export const TIPS = {
  start: '첫 전투를 시작해 보세요. 영웅들은 알아서 싸웁니다.',
  ult: '게이지가 가득 찬 영웅의 초상화를 누르면 필살기! 위의 AUTO 를 켜면 알아서 씁니다.',
  swap: '앞줄 영웅이 위험할 때 ⇅ 를 누르면 앞줄과 뒷줄이 자리를 바꿉니다. 적은 앞줄을 더 노립니다.',
  hero: '[영웅] 에서 골드로 레벨을 올리고, 장비·특성·행동 방침을 정합니다.',
  missions: '[임무] 를 채우면 보석을 받습니다. 출석도 여기서.',
  summon: '[소환] 에서 보석으로 새 영웅과 장비를 뽑습니다. 같은 진영 영웅을 모으면 시너지가 켜집니다.',
  dungeon: '[던전] 에 요일 던전·무한탑·레이드·모의전이 있습니다. 강화석·정수·승격석은 여기서 모읍니다.',
} as const;
export type TipId = keyof typeof TIPS;

let open = false;
export const tipOpen = () => open;
export const seen = (s: SaveData, id: TipId) => !!s.tut && (s.tut.includes('*') || s.tut.includes(id));

/** 안 본 안내면 띄우고 true (닫히면 onClose). 이미 봤거나, 다른 안내가 떠 있거나, 가리킬 곳이 안 보이면 false */
export function showTip(s: SaveData, id: TipId, target: Element | null, onClose?: () => void) {
  if (open || seen(s, id) || !target) return false;
  const r = target.getBoundingClientRect();
  if (!r.width) return false;   // 화면에 안 보인다
  open = true;
  (s.tut ??= []).push(id);
  writeSave(s);
  const app = document.getElementById('app')!;
  const a = app.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'tip-ov';
  const pad = 6;
  const below = r.top - a.top < a.height * 0.45;   // 가리킨 곳이 위쪽이면 말풍선을 아래에
  el.innerHTML = `
    <div class="tip-hole" style="left:${r.left - a.left - pad}px;top:${r.top - a.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px"></div>
    <div class="tip-box" style="${below ? `top:${r.bottom - a.top + 16}px` : `bottom:${a.bottom - r.top + 16}px`}">${TIPS[id]}<small>누르면 닫힌다</small></div>`;
  app.append(el);
  const close = (e: Event) => {
    e.stopPropagation();
    el.remove();
    open = false;
    onClose?.();
  };
  // 띄우자마자 같은 터치로 닫히지 않게 조금 뒤부터 받는다
  setTimeout(() => el.addEventListener('pointerdown', close), 350);
  return true;
}
