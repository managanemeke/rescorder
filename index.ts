/// <reference lib="dom" />

import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import path from 'path';
import ffmpeg from 'ffmpeg-static';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const [url = 'https://example.com', duration = '5000'] = Bun.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const tempDir = path.join(process.cwd(), 'temp_frames');
  await mkdir(tempDir, { recursive: true });

  const videoFrames: string[] = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const bodyRect = await page.evaluate(() => {
      const rect = document.body.getBoundingClientRect();
      return {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });

    const frameCount = Math.ceil(Number(duration) / 100);

    for (let i = 0; i < frameCount; i++) {
      const addFrame = async () => {
        const framePath = path.join(tempDir, `frame_${Number(i).toString().padStart(4, '0')}.png`);
        const buffer = await page.screenshot({
          clip: bodyRect,
          type: 'png'
        });
        writeFileSync(framePath, buffer);
        videoFrames.push(framePath);
      };
      await addFrame();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const outputPath = path.join(process.cwd(), 'body_recording.mp4');
    const ffmpegCmd = [
      `"${ffmpeg}"`,
      '-y',
      '-framerate 10',
      `-i "${path.join(tempDir, 'frame_%04d.png')}"`,
      '-c:v libx264',
      '-pix_fmt yuv420p',
      `"${outputPath}"`
    ].join(' ');

    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log(`Video saved to ${outputPath}`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    videoFrames.forEach(frame => {
      try { unlinkSync(frame); } catch {}
    });
    await browser.close();
  }
})();