import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
let scrapePage: Page | null = null; // Dedicated page for scraping
let signupPage: Page | null = null; // Dedicated page for signups

// Mutex — prevents scraper from navigating while a signup is in progress
let signupInProgress = false;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--single-process',
];

export async function initBrowser(): Promise<void> {
  browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: LAUNCH_ARGS,
  });

  // Open two separate pages so scraping and signup never share state
  scrapePage = await browser.newPage();
  signupPage = await browser.newPage();

  console.log('🌐 Browser initialized with dedicated scrape + signup pages');
}

/** Returns the scraping page. Throws if a signup is currently in progress. */
export function getScrapePage(): Page {
  if (!scrapePage) throw new Error('Browser not initialized');
  return scrapePage;
}

/** Returns the dedicated signup page — never used for scraping. */
export function getSignupPage(): Page {
  if (!signupPage) throw new Error('Browser not initialized');
  return signupPage;
}

/** Call before starting a signup to block the scraper from interfering. */
export function lockForSignup(): void {
  signupInProgress = true;
  console.log('🔒 Signup lock acquired — scraper will wait');
}

/** Call when signup is complete (success or failure) to release the scraper. */
export function releaseSignupLock(): void {
  signupInProgress = false;
  console.log('🔓 Signup lock released — scraper can resume');
}

/** Returns true if a signup is currently in progress. */
export function isSignupInProgress(): boolean {
  return signupInProgress;
}

export async function closeBrowser(): Promise<void> {
  if (browser) await browser.close();
}
