import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { mkdir } from 'fs/promises';
import path from 'path';

const [url = 'https://example.com', duration = '5000'] = Bun.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const recorder = new PuppeteerScreenRecorder(page);

  const outputDir = path.join(process.cwd(), 'recordings');
  const outputPath = path.join(outputDir, 'output.mp4');

  try {
    await mkdir(outputDir, { recursive: true });
  } catch (err) {
    console.error('Ошибка при создании директории:', err);
    await browser.close();
    return;
  }

  try {
    await recorder.start(outputPath);
    await page.goto(url);
    await page.waitForTimeout(Number(duration));
    await recorder.stop();
  } catch (err) {
    console.error('Ошибка записи:', err);
  } finally {
    await browser.close();
  }
})();