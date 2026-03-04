import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let scrapePage: Page | null = null;
let signupPage: Page | null = null;
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
      '--disable-extensions',
      '--single-process', // Critical for Fly.io Firecracker VMs
      '--no-zygote', // Prevents fork issues in constrained envs
    ],
    timeout: 60000, // Give Chromium 60s to start
  });

  scrapePage = await browser.newPage();
  signupPage = await browser.newPage();

  // Set a realistic user agent so the site doesn't block headless browsers
  const UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  await scrapePage.setUserAgent(UA);
  await signupPage.setUserAgent(UA);

  console.log('🌐 Browser initialized with dedicated scrape + signup pages');
}

export function getScrapePage(): Page {
  if (!scrapePage) throw new Error('Browser not initialized');
  return scrapePage;
}

export function getSignupPage(): Page {
  if (!signupPage) throw new Error('Browser not initialized');
  return signupPage;
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
