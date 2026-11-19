// 진행에 따라 열리는 화면 확인 (헤드리스 Chrome 390×844). 스크린샷은 logs/unlock-check/
// 실행: 개발 서버(npm run dev)를 띄운 채 node src/tools/check-unlocks.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:5173/';
const OUT = 'logs/unlock-check';
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on('pageerror', e => console.log('PAGE ERROR', e.message));

let bad = 0;
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) bad++; };
const shot = name => page.screenshot({ path: `${OUT}/${name}.png` });
const ids = (ch, k) => Array.from({ length: k }, (_, i) => `${ch}-${i + 1}`);
const ALL = [...ids(1, 10), ...ids(2, 10)];
const boot = async () => { await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.game && document.querySelector('#lobby .lb-tabs'), { timeout: 90000 }); };
/** 진행을 바꾸고 로비를 다시 그린다 */
const setCleared = (list, extra = {}) => page.evaluate((list, extra) => {
  const g = window.game;
  Object.assign(g.save, extra);
  g.save.cleared = list;
  g.lobby.show(g.save);
}, list, extra);
const tabs = () => page.$$eval('#lobby .lb-tabs button', bs => bs.map(b => b.dataset.tab));
const visible = sel => page.evaluate(sel => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, sel);

await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await boot();

// 1. 새 저장: 모험 하나, 편성·임무 없음
ok(JSON.stringify(await tabs()) === '["adventure"]', `새 저장 탭 = 모험만 (${await tabs()})`);
ok(!(await visible('#lobby .form-t')) && !(await visible('#lobby .ms-t')), '새 저장: 편성·임무 버튼 없음');
await shot('01-new-save');

// 2. 전투: 배속·AUTO·⇅ 숨김, 이기면 결과에 새로 열림
await page.evaluate(() => window.game.startBattle('1-1'));
await page.waitForFunction(() => window.battle && document.getElementById('hud').style.display !== 'none', { timeout: 60000 });
const btns = await page.$$eval('#hud .btns button', bs => bs.filter(b => getComputedStyle(b).display !== 'none').map(b => b.textContent));
ok(JSON.stringify(btns) === '["❚❚"]', `1-1 전투 버튼 = 일시정지만 (${btns})`);
await shot('02-battle-1-1');
await page.evaluate(() => window.battle.onEnd(true));
await page.waitForSelector('#hud .result:not(.hide)');
const resTxt = await page.$eval('#hud .result', e => e.textContent);
ok(/새로 열림/.test(resTxt) && /영웅/.test(resTxt) && /배속/.test(resTxt), '1-1 승리: 결과에 "새로 열림 · 영웅 · 배속"');
await shot('03-result-1-1');
await page.click('#hud .result .lobby');
await page.waitForFunction(() => document.getElementById('lobby').style.display !== 'none');

// 3. 영웅 탭이 새것으로 빛나고, 누르면 꺼진다
ok(await page.$('#lobby .lb-tabs [data-tab="hero"][data-new]') !== null, '1-1 뒤: 영웅 탭 [data-new]');
await page.click('#lobby .stage.sel');   // 다른 곳을 눌러 다시 그린다
ok(!(await page.$eval('#lobby .lb-tabs [data-tab="hero"]', b => getComputedStyle(b).animationName)).includes('tabrise'), '다시 그려도 탭 등장 애니메이션을 되풀이하지 않음');
await shot('04-lobby-after-1-1');
await page.click('#lobby .lb-tabs [data-tab="hero"]');
await page.waitForFunction(() => document.querySelector('#lobby .lb-tabs [data-tab="hero"].on'));
ok(await page.$('#lobby .lb-tabs [data-tab="hero"][data-new]') === null, '영웅 탭을 누르면 빛 꺼짐');
ok(await page.evaluate(() => window.game.save.seen.includes('hero')), 'save.seen 에 hero');

// 4. 탭 수: 1-5 까지 4개, 1-10 까지 5개
// 오늘 출석은 받은 것으로 (안 받았으면 로비가 임무 창부터 연다)
const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await page.evaluate(today => { window.game.save.attend.last = today; }, today);
await setCleared(ids(1, 5));
ok(JSON.stringify(await tabs()) === '["adventure","hero","summon","bag"]', `1-5 까지 탭 4개 (${await tabs()})`);
ok(await visible('#lobby .form-t') && await visible('#lobby .ms-t'), '1-5 까지: 편성·임무 버튼 있음');
await setCleared(ids(1, 10));
ok((await tabs()).length === 5, `1-10 까지 탭 5개 (${await tabs()})`);
await shot('05-lobby-1-10');

// 4-1. 승격·별은 1-8 을 깨면 영웅 탭 안에서 빛난다
await setCleared(ids(1, 8), { seen: ['hero', 'speed', 'gear', 'bag', 'missions', 'auto', 'swap', 'summon', 'form', 'policy', 'talent'] });
await page.click('#lobby .lb-tabs [data-tab="hero"]');
await page.waitForFunction(() => document.querySelector('#lobby .lb-tabs [data-tab="hero"].on'));
ok(await page.$('#lobby [data-feat="promo"][data-new]') !== null, '1-8 뒤: 승격·별 빛');
await page.click('#lobby .lb-tabs [data-tab="adventure"]');

// 5. 점: 레벨이 다음 적보다 낮고 골드가 있으면 영웅 탭에 점
await setCleared(ids(1, 9), { gold: 1e7, seen: ['hero', 'speed', 'gear', 'bag', 'missions', 'auto', 'swap', 'summon', 'form', 'policy', 'talent', 'promo'] });
ok(await page.$('#lobby .lb-tabs [data-tab="hero"] .dot') !== null, '레벨 낮고 골드 있음: 영웅 탭 점');

// 6. 패배 바로가기: 1-10 에 Lv.1 파티로 지면 [레벨 올리기] → 영웅 탭
await page.evaluate(() => window.game.startBattle('1-10'));
await page.waitForFunction(() => window.battle && window.battle.stage?.id === '1-10' || document.getElementById('hud').style.display !== 'none', { timeout: 60000 });
await page.waitForFunction(() => window.battle.state === 'fight', { timeout: 30000 });
const swapTop0 = await page.$eval('#hud .btn.swap', b => b.getBoundingClientRect().top);
await page.evaluate(() => { const h = window.battle.heroes.find(h => h.slot < 2); h.hp = h.maxHp * 0.2; });
await new Promise(r => setTimeout(r, 600));
const sw = await page.$eval('#hud .btn.swap', b => ({ top: b.getBoundingClientRect().top, anim: getComputedStyle(b).animationName }));
ok(sw.anim.includes('newglow'), `앞줄 위험: ⇅ 빛 (${sw.anim})`);
ok(Math.abs(sw.top - swapTop0) < 2, `⇅ 가 제자리 (${swapTop0} → ${sw.top})`);
await shot('06a-swap-hint');
await page.evaluate(() => window.battle.onEnd(false));
await page.waitForSelector('#hud .result:not(.hide)');
const links = await page.$$eval('#hud .result .rlink', bs => bs.map(b => b.textContent));
ok(links.includes('레벨 올리기') && links.length <= 2, `패배 바로가기 (${links})`);
await shot('06-defeat');
if (links.includes('레벨 올리기')) {
  await page.evaluate(() => [...document.querySelectorAll('#hud .result .rlink')].find(b => b.textContent === '레벨 올리기').click());
  await page.waitForFunction(() => document.getElementById('lobby').style.display !== 'none');
  ok(await page.$('#lobby .lb-tabs [data-tab="hero"].on') !== null, '[레벨 올리기] → 영웅 탭');
  await shot('07-defeat-link');
}

// 7. seen 없는 다 깬 저장(하던 저장): 빛 0개
await page.evaluate(all => {
  const s = JSON.parse(localStorage.getItem('party-rpg-save'));
  s.cleared = all;
  delete s.seen;
  localStorage.setItem('party-rpg-save', JSON.stringify(s));
}, ALL);
await boot();
ok((await tabs()).length === 5, '하던 저장: 탭 5개');
ok((await page.$$('#lobby [data-new]')).length === 0, '하던 저장: 빛 0개');
await shot('08-old-save');

await browser.close();
console.log(bad ? `${bad} FAIL` : 'ALL OK');
process.exit(bad ? 1 : 0);
