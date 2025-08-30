/// <reference lib="dom" />

import puppeteer from 'puppeteer';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import ffmpeg from 'ffmpeg-static';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const [
  url = 'https://example.com',
  name = 'output',
  duration = '5000',
  rate = '25',
] = Bun.argv.slice(2);

(async () => {
  const framesPerSecond = Number(rate);
  const timeout = 60 * 1000;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  const tempDir = path.join(process.cwd(), 'temp_frames');
  await mkdir(tempDir, { recursive: true });

  try {
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeout,
    });

    const bodyRect = await page.evaluate(() => {
      const rect = document.body.getBoundingClientRect();
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });

    const frameCount = Math.ceil(Number(duration) / 1000) * framesPerSecond;
    const frameDuration = 1000 / framesPerSecond;

    console.log("Запись начата. Кадров:", frameCount, "Интервал:", frameDuration, "мс");

    const screenshotPromises: Promise<Uint8Array>[] = [];

    const takeScreenshot = async (index: number): Promise<Uint8Array> => {
      try {
        return await page.screenshot({
          clip: bodyRect,
          type: 'png',
        });
      } catch (error) {
        console.error(`Ошибка при скриншоте ${index}:`, error);
        throw error;
      }
    };

    for (let i = 0; i < frameCount; i++) {
      const promise = new Promise<Uint8Array>((resolve) => {
        setTimeout(async () => {
          try {
            const screenshot = await takeScreenshot(i);
            resolve(screenshot);
          } catch (error) {
            resolve(new Uint8Array());
          }
        }, i * frameDuration);
      });
      screenshotPromises.push(promise);
    }

    const screenshots = await Promise.all(screenshotPromises);

    for (let [index, screenshot] of screenshots.entries()) {
      if (screenshot.length > 0) {
        const framePath = path.join(tempDir, `frame_${index.toString().padStart(4, '0')}.png`);
        writeFileSync(framePath, screenshot);
      }
    }

    const outputPath = path.join(process.cwd(), 'output', `${name}.mp4`);
    const ffmpegCmd = [
      `"${ffmpeg}"`,
      '-y',
      `-framerate ${framesPerSecond}`,
      `-i "${path.join(tempDir, 'frame_%04d.png')}"`,
      '-c:v libx264',
      '-pix_fmt yuv420p',
      '-crf 23',
      `"${outputPath}"`
    ].join(' ');

    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`Видео сохранено: ${outputPath}`);

  } catch (err) {
    console.error('Ошибка:', err);
  } finally {
    await browser.close().catch(console.error);
    try {
      await rm(tempDir, { recursive: true, force: true });
      console.log('Временные файлы удалены');
    } catch (cleanupError) {
      console.warn('Не удалось очистить временные файлы:', cleanupError);
    }
  }
})();
