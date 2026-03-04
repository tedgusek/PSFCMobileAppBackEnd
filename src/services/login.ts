import { getScrapePage, getSignupPage } from './browser';
import { config } from '../config';

async function loginOnPage(page: any, label: string): Promise<void> {
  console.log(`🔐 Logging in (${label})...`);

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error('Missing FOODCOOP_USERNAME or FOODCOOP_PASSWORD env vars');
  }

  // 'commit' resolves immediately on first byte — avoids all JS evaluation timeouts
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'commit' as any,
    timeout: 30000,
  });

  // Wait for the actual DOM elements we need before interacting
  await page.waitForSelector('#id_username', { timeout: 30000 });
  await page.waitForSelector('#id_password', { timeout: 10000 });
  await page.waitForSelector('#submit', { timeout: 10000 });

  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);
  await page.click('#submit');

  // Poll URL every second until we leave the login page
  const maxWait = 30000;
  const pollInterval = 1000;
  let elapsed = 0;

  while (elapsed < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const currentUrl = page.url();
    console.log(`🔗 (${label}) ${elapsed / 1000}s — url: ${currentUrl}`);

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
