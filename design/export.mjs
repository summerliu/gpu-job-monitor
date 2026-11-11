// 把 mockups.html 的每個畫面匯出成 PNG：node design/export.mjs
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const FRAMES = {
    s01: '01-job-list.png',
    s02: '02-job-list-states.png',
    s03: '03-job-detail.png',
    s04: '04-job-detail-partial.png',
    s05: '05-job-logs.png',
    s06a: '06-stop-confirm.png',
    s06b: '06-stop-failed.png',
    s07: '07-tablet.png',
};

const dir = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
});
await page.goto(`file://${dir}mockups.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
for (const [id, file] of Object.entries(FRAMES)) {
    await page.locator(`#${id}`).screenshot({ path: `${dir}${file}` });
    console.log(file);
}
await browser.close();
