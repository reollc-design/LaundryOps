import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..', '..');
const outputDir = path.join(appRoot, 'test-results', 'landing');
const baseUrl = process.env.LANDING_VISUAL_URL ?? 'http://127.0.0.1:3100/?screen=welcome&visual=landing';
const viewports = [390, 430];

async function serverIsReady(url) {
  try {
    const response = await fetch(url, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await serverIsReady(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Landing visual server did not become ready at ${url}`);
}

function startDevServer() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawn(npmCommand, ['run', 'dev'], {
    cwd: appRoot,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    return chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
    });
  }
}

let devServer;
let startedServer = false;

try {
  await mkdir(outputDir, { recursive: true });

  if (!(await serverIsReady(baseUrl))) {
    devServer = startDevServer();
    startedServer = true;
    await waitForServer(baseUrl);
  }

  const browser = await launchBrowser();
  const results = [];

  for (const width of viewports) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      isMobile: true,
      deviceScaleFactor: 1,
    });

    await page.route('**/favicon.ico', (route) => {
      route.fulfill({ status: 204, body: '' });
    });

    const consoleMessages = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => {
      const images = Array.from(document.images);
      return images.every((image) => image.complete && image.naturalWidth > 0);
    });

    const screenshotPath = path.join(outputDir, `landing-${width}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.push({ width, screenshotPath, consoleMessages });
    await page.close();
  }

  await browser.close();

  console.log(JSON.stringify({
    url: baseUrl,
    startedServer,
    outputDir,
    results,
  }, null, 2));
} finally {
  if (devServer) {
    devServer.kill();
  }
}
