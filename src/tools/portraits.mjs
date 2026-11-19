// 영웅 16명의 시작 등급 초상화를 파일로 찍는다 → public/portraits/{id}.webp (192px)
// 게임은 지금 외형을 실행 중에 다시 찍고, 아직 못 찍은 영웅(안 가진 영웅의 소환 카드 등)에만 이 파일을 쓴다
// 실행: 개발 서버(npm run dev)를 띄운 채 node src/tools/portraits.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const URL = process.env.URL ?? 'http://localhost:5173/';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.game, { timeout: 90000 });
// 새 저장에 모든 영웅을 시작 등급으로 넣는다 (파티 4명은 이미 그 등급으로 찍혀 있다)
const ids = await page.evaluate(async () => {
  const { HEROES } = await import('/src/data.ts');
  const s = window.game.save;
  for (const h of HEROES) s.heroes[h.id] ??= { level: 1, grade: h.startGrade ?? 2 };
  s.cleared = ['1-1'];   // 영웅 탭은 1-1 을 깨야 열린다 (unlocks.ts)
  window.game.lobby.show(s);
  for (const b of document.querySelectorAll('#lobby button')) if (b.textContent.trim() === '닫기') b.click();
  document.querySelector('.lb-tabs [data-tab="hero"]').click();
  return HEROES.map(h => h.id);
});
fs.mkdirSync('public/portraits', { recursive: true });
for (const id of ids) {
  await page.evaluate(id => document.querySelector(`.chip[data-id="${id}"]`).click(), id);
  await page.waitForFunction(id => window.game.lobby.portraits[id], { timeout: 60000 }, id);
  const url = await page.evaluate(id => window.game.lobby.portraits[id], id);
  fs.writeFileSync(`public/portraits/${id}.webp`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(id, fs.statSync(`public/portraits/${id}.webp`).size);
}
await browser.close();
