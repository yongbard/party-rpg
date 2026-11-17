import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
// itch.io 무료 팩 받기: node src/tools/fetch-itch.mjs <팩 페이지 URL>...  → data/quaternius/zips/
// (itch 는 버튼을 눌러야 받을 수 있어 설치된 Chrome 을 헤드리스로 띄운다. 이름이 Standard 인 파일만 받는다)
const outDir = 'data/quaternius/zips';
fs.mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
page.setDefaultTimeout(30000);
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' });
for (const url of process.argv.slice(2)) {
  await page.goto(url + '/purchase', { waitUntil: 'domcontentloaded' });
  await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded' }), page.click('.direct_download_btn')]);
  await new Promise(r => setTimeout(r, 1500));
  const ups = await page.$$('.upload');
  for (const u of ups) {
    const name = await u.evaluate(x => x.querySelector('.name')?.textContent.trim() ?? '');
    const btn = await u.$('.download_btn');
    if (!btn || !/Standard/i.test(name)) { console.log('  skip', name); continue; }
    const resP = page.waitForResponse(r => /\/file\/\d+/.test(r.url()), { timeout: 30000 });
    await btn.click();
    const res = await resP;
    let dl; try { dl = (await res.json()).url; } catch {}
    console.log('  api', res.status(), res.url().replace(/key=.*/, 'key=…'), dl ? 'url ok' : 'no url');
    if (!dl) continue;
    const file = `${outDir}/${name.replace(/[\/:*?"<>|]/g, '_')}`;
    const r2 = await fetch(dl);
    const total = Number(r2.headers.get('content-length') || 0);
    console.log('  downloading', name, Math.round(total / 1048576) + 'MB');
    await pipeline(Readable.fromWeb(r2.body), fs.createWriteStream(file));
    console.log('  saved', Math.round(fs.statSync(file).size / 1048576) + 'MB');
  }
}
await browser.close();
