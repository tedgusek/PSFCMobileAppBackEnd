import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { config } from '../config';

let browser: Browser | null = null;
let page: Page | null = null;

export async function initBrowser() {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage();

  //   if (fs.existsSync(config.SESSION_FILE)) {
  //     const cookies = JSON.parse(fs.readFileSync(config.SESSION_FILE, 'utf-8'));
  //     await page.setCookie(...cookies);
  //     console.log('✅ Session restored');
  //   }
}

export function getPage(): Page | null {
  return page;
}

export async function closeBrowser() {
  if (browser) await browser.close();
}
