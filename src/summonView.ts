// 소환 연출: 소환진 → 카드 깔기 → 한 장씩 뒤집기(등급 색, 전설 이상은 멈칫 + 빛) → 결과. 아무 데나 누르면 건너뛴다
import { GRADES, GRADE_COLORS, HEROES } from './data';
import type { Pull } from './gacha';
import { baseOf, ITEM_ICON } from './items';

function card(p: Pull, portraits: Record<string, string>, hi: number) {
  let face: string, name: string, tag = '';
  if (p.kind === 'hero') {
    const d = HEROES.find(h => h.id === p.id)!;
    face = portraits[d.id] ? `<img src="${portraits[d.id]}" alt="">` : `<b class="sm-ini" style="color:${d.color}">${d.name[0]}</b>`;
    name = d.name;
    tag = p.isNew ? '<em class="new">NEW</em>' : `<em>조각 +${p.shards}</em>`;
  } else {
    face = `<i class="ico" style="--ico:url(${ITEM_ICON(p.item)})"></i>`;
    name = baseOf(p.item).name;
  }
  return `<div class="sm-c ${p.grade >= hi ? 'hi' : ''}" style="--gc:${GRADE_COLORS[p.grade]}">
    <div class="sm-in">
      <div class="sm-back"></div>
      <div class="sm-front">${face}<small>${p.kind === 'hero' ? '잠재 ' : ''}${GRADES[p.grade]}</small><span>${name}</span>${tag}</div>
    </div></div>`;
}

export function showSummon(pulls: Pull[], portraits: Record<string, string>, hi: number, again: { label: string; ok: boolean }, onAgain: () => void, onClose: () => void) {
  const best = Math.max(...pulls.map(p => p.grade));
  const el = document.createElement('div');
  el.className = `sm-ov ${pulls.length > 1 ? 'n10' : 'n1'}`;
  // 전조: 전설 이상이 들어 있으면 소환진 색이 그 등급 색이 된다
  el.style.setProperty('--bc', best >= hi ? GRADE_COLORS[best] : '#6fd3ff');
  el.innerHTML = `
    <div class="sm-circle"><i></i><i></i><i></i></div>
    <div class="sm-grid">${pulls.map(p => card(p, portraits, hi)).join('')}</div>
    <div class="sm-foot"><span class="sm-hint">누르면 건너뛴다</span></div>`;
  document.getElementById('app')!.append(el);
  const cards = [...el.querySelectorAll<HTMLElement>('.sm-c')];
  const timers: number[] = [];
  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

  let t = 900;
  at(t, () => el.classList.add('deal'));
  t += 350 + cards.length * 50;
  cards.forEach((c, i) => {
    const isHi = pulls[i].grade >= hi;
    if (isHi) { at(t, () => c.classList.add('charge')); t += 550; }
    at(t, () => c.classList.add('open'));
    t += isHi ? 700 : 170;
  });
  at(t + 150, () => finish());

  let done = false;
  function finish() {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    el.classList.add('deal', 'done');
    cards.forEach(c => c.classList.add('open'));
    el.querySelector('.sm-foot')!.innerHTML = `
      <button class="sm-again" ${again.ok ? '' : 'disabled'}>${again.label}</button>
      <button class="sm-ok">확인</button>`;
    const close = () => el.remove();
    (el.querySelector('.sm-ok') as HTMLButtonElement).onclick = e => { e.stopPropagation(); close(); onClose(); };
    (el.querySelector('.sm-again') as HTMLButtonElement).onclick = e => { e.stopPropagation(); close(); onAgain(); };
  }
  el.addEventListener('click', () => finish());
}
