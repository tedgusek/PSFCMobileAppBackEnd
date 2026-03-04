import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let page: Page | null = null;
let signupInProgress = false;

export async function initBrowser(): Promise<void> {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',
      '--no-zygote',
    ],
  });

  page = await browser.newPage();

  const UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  await page.setUserAgent(UA);

  console.log('🌐 Browser initialized');
}

export function getPage(): Page {
  if (!page) throw new Error('Browser not initialized');
  return page;
}

// Keep these for signup route compatibility
export function getScrapePage(): Page {
  return getPage();
}
export function getSignupPage(): Page {
  return getPage();
}

export function lockForSignup(): void {
  signupInProgress = true;
  console.log('🔒 Signup lock acquired');
}

export function releaseSignupLock(): void {
  signupInProgress = false;
  console.log('🔓 Signup lock released');
}

export function isSignupInProgress(): boolean {
  return signupInProgress;
}

export async function closeBrowser(): Promise<void> {
  if (browser) await browser.close();
}
