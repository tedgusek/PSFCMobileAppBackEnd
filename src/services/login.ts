import { getScrapePage, getSignupPage } from './browser';
import { config } from '../config';

async function loginOnPage(page: any, label: string): Promise<void> {
  console.log(`🔐 Logging in (${label})...`);

  // Navigate to login page
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error('Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars');
  }

  // Wait for username field and fill credentials
  await page.waitForSelector('#id_username', { timeout: 10000 });
  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);

  // Click submit — then just wait for URL to change, no evaluate() calls
  await page.click('#submit');

  // Poll URL directly — no page.evaluate(), no waitForNavigation
  // These are what cause the Runtime.callFunctionOn timeout
  const maxWait = 30000;
  const pollInterval = 1000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const currentUrl = page.url();
    console.log(`🔗 (${label}) current URL: ${currentUrl}`);

    if (!currentUrl.includes('/login')) {
      console.log(`✅ Login successful (${label})`);
      return;
    }
  }

  throw new Error(`Login timed out after ${maxWait}ms — still on login page`);
}

export async function login(): Promise<void> {
  await loginOnPage(getScrapePage(), 'scrape page');
}

export async function loginSignupPage(): Promise<void> {
  await loginOnPage(getSignupPage(), 'signup page');
}
