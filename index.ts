/// <reference lib="dom" />

import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import { mkdir } from 'fs/promises';
import path from 'path';

const [url = 'https://example.com', duration = '5000'] = Bun.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(url);
  const bodySize = await page.evaluate(() => ({
    width: document.body.offsetWidth,
    height: document.body.offsetHeight
  }));

  const bodyPosition = await page.evaluate(() => {
    const rect = document.body.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  });

  const recorder = new PuppeteerScreenRecorder(page, {
    videoFrame: {
      width: bodySize.width,
      height: bodySize.height,
      x: bodyPosition.x,
      y: bodyPosition.y
    },
    fps: 30
  });

  const outputDir = path.join(process.cwd(), 'recordings');
  const outputPath = path.join(outputDir, 'output.mp4');

  try {
    await mkdir(outputDir, { recursive: true });
    await recorder.start(outputPath);

    await page.waitForTimeout(Number(duration));
    await recorder.stop();
    console.log(`Recording of body saved to ${outputPath}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();