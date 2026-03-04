import { getSignupPage, lockForSignup, releaseSignupLock } from './browser';
import { config } from '../config';

/**
 * Navigates the dedicated signup page to the shift URL, fills all 3 initials
 * fields, waits for them to be populated, then clicks "Work this shift".
 *
 * Uses a separate Puppeteer page from the scraper so the two never conflict.
 * Acquires a mutex lock for the duration so the scraper doesn't fire a diff
 * immediately after and produce false positives.
 */
export async function signUpForShift(
  href: string,
  initials: string,
): Promise<void> {
  const page = getSignupPage();

  // Acquire lock — scraper will skip its next tick if this is held
  lockForSignup();

  try {
    const signupUrl = `https://members.foodcoop.com${href}`;
    console.log(`🖱️  Navigating signup page to: ${signupUrl}`);

    await page.goto(signupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // ── Session check ───────────────────────────────────────────────────────
    if (page.url().includes('/login')) {
      // The signup page needs its own session — copy cookies from scrape page
      // by re-logging in on this page
      console.log(
        '🔐 Signup page session expired — logging in on signup page...',
      );
      await loginOnPage(page);
      await page.goto(signupUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    }

    // ── Wait for form ───────────────────────────────────────────────────────
    await page.waitForSelector('form.mainform', { timeout: 10000 });
    console.log('📋 Signup form found');

    // ── Fill each initials field, one at a time, with verification ──────────
    const fields = ['initials1', 'initials2', 'initials4'];

    for (const fieldName of fields) {
      const selector = `input[name="${fieldName}"]`;

      // Wait for the field to be present and visible
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });

      // Triple-click to select any existing content, then type
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, initials, { delay: 50 }); // Small delay between keystrokes

      // Verify the value was actually set
      const value = await page.$eval(
        selector,
        (el) => (el as HTMLInputElement).value,
      );
      if (value !== initials) {
        throw new Error(
          `Failed to set ${fieldName} — expected "${initials}", got "${value}"`,
        );
      }

      console.log(`✏️  Verified ${fieldName} = "${value}"`);
    }

    // ── Small pause to let any JS validation on the form settle ────────────
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ── Click submit ────────────────────────────────────────────────────────
    const submitSelector = 'input[name="claim"]';
    await page.waitForSelector(submitSelector, {
      visible: true,
      timeout: 5000,
    });

    // Wait for navigation triggered by form submission
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click(submitSelector),
    ]);

    console.log('🖱️  Clicked "Work this shift" — navigated to result page');

    // ── Check result page for failure indicators ────────────────────────────
    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase(),
    );

    const failureKeywords = [
      'error',
      'already signed up',
      'unavailable',
      'full',
      'invalid',
    ];
    for (const keyword of failureKeywords) {
      if (pageText.includes(keyword)) {
        await page.screenshot({ path: '/tmp/signup-result.png' });
        throw new Error(`Signup may have failed — page contains: "${keyword}"`);
      }
    }

    console.log('✅ Shift signup completed successfully');
  } finally {
    // Always release the lock, even if signup threw
    releaseSignupLock();
  }
}

/**
 * Logs in on a specific page instance (used for the signup page's own session).
 */
async function loginOnPage(page: any): Promise<void> {
  await page.goto('https://members.foodcoop.com/services/login/', {
    waitUntil: 'networkidle2',
  });

  if (!config.FOODCOOP_USERNAME || !config.FOODCOOP_PASSWORD) {
    throw new Error('Missing credentials');
  }

  await page.type('#id_username', config.FOODCOOP_USERNAME);
  await page.type('#id_password', config.FOODCOOP_PASSWORD);
  await Promise.all([page.click('#submit'), page.waitForNavigation()]);
  console.log('✅ Signup page logged in');
}
