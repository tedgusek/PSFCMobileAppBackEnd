import { getScrapePage, getSignupPage } from './browser';
import { config } from '../config';

async function loginOnPage(page: any, label: string): Promise<void> {
  console.log(`🔐 Logging in (${label})...`);

  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error('Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars');
  }

  await page.waitForSelector('#id_username', { timeout: 10000 });
  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);
  await page.click('#submit');

  // Don't use waitForNavigation — instead poll until we're no longer on the login page
  // The foodcoop login redirect can take varying amounts of time
  const maxWait = 20000;
  const interval = 500;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    elapsed += interval;

    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      console.log(
        `✅ Login successful (${label}) — redirected to: ${currentUrl}`,
      );
      return;
    }

    // Check for error message on the login page
    const errorText = await page.evaluate(() => {
      const el = document.querySelector('.error, .alert, .errorlist');
      return el ? el.textContent?.trim() : null;
    });

    if (errorText) {
      throw new Error(`Login failed — site says: "${errorText}"`);
    }
  }

  throw new Error(`Login timed out after ${maxWait}ms — still on login page`);
}

/** Logs in the scrape page */
export async function login(): Promise<void> {
  const page = getScrapePage();
  await loginOnPage(page, 'scrape page');
}

/** Logs in the signup page — called when signup page session expires */
export async function loginSignupPage(): Promise<void> {
  const page = getSignupPage();
  await loginOnPage(page, 'signup page');
}
