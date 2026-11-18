// 설정 화면: 소리, 전투 배속, 저장 내보내기·가져오기, 튜토리얼 다시 보기, 처음부터, 크레딧 (docs/credits.md 와 같게)
import { exportCode, parseSave, resetSave, storeSave, writeSave, type SaveData } from './save';
import { sound } from './sound';

const CREDITS: [string, string, string][] = [
  ['3D 캐릭터·의상·애니메이션', 'Quaternius — Universal Base Characters, Modular Outfits, Fantasy Races, Bestiary, Universal Animation Library 1·2, Ultimate Monsters (quaternius.com)', 'CC0 / Quaternius Asset License'],
  ['던전·투구·망토·무기 일부', 'Kay Lousberg — KayKit Dungeon Remastered, Adventurers, Skeletons, Fantasy Weapons Bits (www.kaylousberg.com)', 'CC0'],
  ['무기 70종', 'Binbun — RPG Weapons', 'CC0'],
  ['장식 소품', 'Quaternius, CreativeTrio — Poly Pizza (poly.pizza)', 'CC0'],
  ['용기사 용 모델', 'Tripo AI 로 생성 (tripo3d.ai)', 'Tripo 무료 계정 결과물'],
  ['장비·메뉴 아이콘', 'game-icons.net — Lorc, Delapouite, Willdabeast', 'CC BY 3.0'],
  ['글꼴', 'Black Han Sans, Noto Sans KR (Google Fonts)', 'SIL OFL 1.1'],
  ['엔진', 'Babylon.js, meshoptimizer (Arseny Kapoulkine), Vite', 'Apache 2.0 / MIT'],
  ['소리·이펙트', '코드로 합성·그림 (Web Audio, src/sound.ts, src/fx.ts)', '직접 제작'],
];

export interface SettingsHooks { onTutorial: () => void }

export function openSettings(save: SaveData, hooks: SettingsHooks) {
  const opt = (save.opt ??= { sfx: 0.7, mus: 0.35, speed: 1 });
  const el = document.createElement('div');
  el.className = 'set-ov';
  document.getElementById('app')!.append(el);
  let view: 'main' | 'credits' = 'main';
  let confirmReset = false;
  let pending: SaveData | null = null;   // 가져오기 확인 대기
  let msg = '';

  const render = () => {
    if (view === 'credits') {
      el.innerHTML = `<div class="set-box">
        <div class="set-h">크레딧<button class="set-x">✕</button></div>
        <div class="cr-list">${CREDITS.map(([k, who, lic]) => `<div><b>${k}</b><span>${who}</span><small>${lic}</small></div>`).join('')}</div>
        <div class="set-note">파티 RPG · 취미로 만든 무료 게임 · 에셋은 모두 무료 공개 자료</div>
        <button class="set-btn set-back">뒤로</button></div>`;
    } else {
      el.innerHTML = `<div class="set-box">
        <div class="set-h">설정<button class="set-x">✕</button></div>
        <div class="set-sec"><b>소리</b>
          <label>효과음<input type="range" class="vol" data-k="sfx" min="0" max="100" value="${Math.round(opt.sfx * 100)}"><em>${Math.round(opt.sfx * 100)}</em></label>
          <label>음악<input type="range" class="vol" data-k="mus" min="0" max="100" value="${Math.round(opt.mus * 100)}"><em>${Math.round(opt.mus * 100)}</em></label>
        </div>
        <div class="set-sec"><b>전투 배속</b><div class="set-row">${[1, 2, 3].map(n => `<button class="set-btn spd ${opt.speed === n ? 'on' : ''}" data-n="${n}">${n}×</button>`).join('')}</div></div>
        <div class="set-sec"><b>저장</b>
          <div class="set-note">저장은 이 기기 브라우저에만 있다. 다른 기기로 옮기거나 지켜 두려면 내보낸다.</div>
          <div class="set-row"><button class="set-btn exp-file">파일로 내보내기</button><button class="set-btn exp-code">코드 복사</button></div>
          <div class="set-row"><button class="set-btn imp-file">파일 가져오기</button><button class="set-btn imp-code">코드 가져오기</button></div>
          <textarea class="imp-text" placeholder="여기에 저장 코드를 붙여 넣고 [코드 가져오기]"></textarea>
          ${pending ? `<div class="set-warn">영웅 ${Object.keys(pending.heroes).length}명 · 골드 ${pending.gold.toLocaleString()} · 깬 스테이지 ${pending.cleared.length}개 저장을 가져오면 지금 진행이 덮어써진다.<div class="set-row"><button class="set-btn danger imp-go">덮어쓰고 다시 시작</button><button class="set-btn imp-no">그만두기</button></div></div>` : ''}
          ${msg ? `<div class="set-msg">${msg}</div>` : ''}
          <input type="file" class="imp-input" accept=".json,.txt,application/json,text/plain" hidden>
        </div>
        <div class="set-sec"><b>기타</b><div class="set-row"><button class="set-btn tut">튜토리얼 다시 보기</button><button class="set-btn cred">크레딧</button></div>
          <button class="set-btn danger reset">${confirmReset ? '정말 지울까? 한 번 더 누르면 처음부터' : '처음부터 다시 하기'}</button></div>
      </div>`;
    }
    const on = (sel: string, fn: (b: HTMLElement) => void) => el.querySelectorAll<HTMLElement>(sel).forEach(b => { b.onclick = e => { e.stopPropagation(); fn(b); }; });
    on('.set-x', () => el.remove());
    on('.set-back', () => { view = 'main'; render(); });
    on('.cred', () => { view = 'credits'; render(); });
    el.querySelectorAll<HTMLInputElement>('.vol').forEach(r => {
      r.oninput = () => {
        opt[r.dataset.k as 'sfx' | 'mus'] = Number(r.value) / 100;
        r.nextElementSibling!.textContent = r.value;
        sound.setVolume(opt.sfx, opt.mus);
      };
      r.onchange = () => { writeSave(save); sound.play('click'); };
    });
    on('.spd', b => { opt.speed = Number(b.dataset.n); writeSave(save); render(); });
    on('.exp-file', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: 'application/json' }));
      a.download = `party-rpg-save-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      msg = '파일로 내보냈다';
      render();
    });
    on('.exp-code', () => {
      const code = exportCode(save);
      const done = () => { msg = '저장 코드를 복사했다. 다른 기기의 [코드 가져오기] 에 붙여 넣는다'; render(); };
      navigator.clipboard?.writeText(code).then(done, () => {
        // 복사가 막힌 브라우저: 글 상자에 넣어 직접 복사하게
        msg = '복사가 막혀 있어 아래 상자에 넣었다. 길게 눌러 복사한다';
        render();
        const t = el.querySelector<HTMLTextAreaElement>('.imp-text')!;
        t.value = code;
        t.select();
      }) ?? done();
    });
    const tryImport = (text: string) => {
      const r = parseSave(text);
      if (typeof r === 'string') { msg = r; pending = null; } else { pending = r; msg = ''; }
      render();
    };
    on('.imp-file', () => el.querySelector<HTMLInputElement>('.imp-input')!.click());
    el.querySelector<HTMLInputElement>('.imp-input')?.addEventListener('change', e => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) void f.text().then(tryImport);
    });
    on('.imp-code', () => tryImport(el.querySelector<HTMLTextAreaElement>('.imp-text')!.value));
    on('.imp-no', () => { pending = null; render(); });
    on('.imp-go', () => { storeSave(pending!); location.reload(); });
    on('.tut', () => { save.tut = []; writeSave(save); el.remove(); hooks.onTutorial(); });
    on('.reset', () => {
      if (!confirmReset) { confirmReset = true; render(); return; }
      resetSave();
      location.reload();
    });
  };
  render();
}
