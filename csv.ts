/// <reference lib="dom" />

import puppeteer from 'puppeteer';
import { mkdir, rm, readFile } from 'fs/promises';
import path from 'path';
import ffmpeg from 'ffmpeg-static';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const [csvFilePath] = Bun.argv.slice(2);

interface CsvRecord {
  campaign: string;
  display: string;
  content: string;
  duration: string;
  rate: string;
}

async function processRecord(record: CsvRecord) {
  const { campaign, display, content, duration, rate } = record;
  const name = `${campaign}_${display}_${content}`;
  const url = `https://light.maergroup.ru/storage/samples/${campaign}/?display=${display}&content=${content}`;

  console.log(`🚀 Starting: ${name}`);
  console.log(`🔗 URL: ${url}`);
  console.log(`⏱️ Duration: ${duration}ms, Rate: ${rate}fps`);

  const framesPerSecond = Number(rate);
  const timeout = 60 * 1000;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(timeout);
  page.setDefaultTimeout(timeout);

  const tempDir = path.join(process.cwd(), 'temp_frames', name);
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

    console.log(`📹 Recording: ${frameCount} frames, ${frameDuration}ms interval`);

    const screenshotPromises: Promise<Uint8Array>[] = [];

    const takeScreenshot = async (index: number): Promise<Uint8Array> => {
      try {
        return await page.screenshot({
          clip: bodyRect,
          type: 'png',
        });
      } catch (error) {
        console.error(`❌ Screenshot error ${index}:`, error);
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
    let validFrames = 0;

    for (let [index, screenshot] of screenshots.entries()) {
      if (screenshot.length > 0) {
        const framePath = path.join(tempDir, `frame_${index.toString().padStart(4, '0')}.png`);
        writeFileSync(framePath, screenshot);
        validFrames++;
      }
    }

    console.log(`✅ Captured ${validFrames}/${frameCount} valid frames`);

    const outputDir = path.join(process.cwd(), 'output');
    await mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${name}.mp4`);
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
    console.log(`🎥 Video saved: ${outputPath}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await browser.close().catch(console.error);
    try {
      await rm(tempDir, { recursive: true, force: true });
      console.log('🧹 Temporary files cleaned');
    } catch (cleanupError) {
      console.warn('⚠️ Could not clean temp files:', cleanupError);
    }
  }
}

async function parseCsv(filePath: string): Promise<CsvRecord[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const records: CsvRecord[] = [];

    const dataLines = lines.slice(1);
    for (const rawLine of dataLines) {
      const line = rawLine.trim();
      if (line === '') continue;

      const [campaign, display, content, duration, rate] = line.split(',');

      records.push({
        campaign: campaign?.trim() ?? "",
        display: display?.trim() ?? "",
        content: content?.trim() ?? "",
        duration: duration?.trim() ?? "",
        rate: rate?.trim() ?? "",
      });
    }

    return records;
  } catch (error) {
    console.error('❌ Error reading CSV file:', error);
    return [];
  }
}

async function main() {
  if (!csvFilePath) {
    console.log('❌ No csv file');
    return;
  }

  console.log(`📁 Processing CSV: ${csvFilePath}`);

  const records = await parseCsv(csvFilePath);

  if (records.length === 0) {
    console.log('❌ No records found in CSV');
    return;
  }

  console.log(`📊 Found ${records.length} records to process`);
  console.log('=' .repeat(50));

  for (const [index, record] of records.entries()) {
    console.log(`\n${index + 1}/${records.length}`);
    await processRecord(record);
    console.log('=' .repeat(50));
  }

  console.log('🎉 All records processed successfully!');
}

main().catch(console.error);
