import { getSignupPage, lockForSignup, releaseSignupLock } from './browser';
import { loginSignupPage } from './login';
import { config } from '../config';

export async function signUpForShift(
  href: string,
  initials: string,
): Promise<void> {
  const page = getSignupPage();
  lockForSignup();

  try {
    const signupUrl = `https://members.foodcoop.com${href}`;
    console.log(`🖱️  Navigating signup page to: ${signupUrl}`);

    await page.goto(signupUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // ── Session check ────────────────────────────────────────────────────────
    if (page.url().includes('/login')) {
      console.log('🔐 Signup page session expired — logging in...');
      await loginSignupPage();
      await page.goto(signupUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
    }

    // ── Wait for form ────────────────────────────────────────────────────────
    await page.waitForSelector('form.mainform', { timeout: 10000 });
    console.log('📋 Signup form found');

    // ── Fill each initials field with verification ───────────────────────────
    for (const fieldName of ['initials1', 'initials2', 'initials4']) {
      const selector = `input[name="${fieldName}"]`;
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, initials, { delay: 50 });

      const value = await page.$eval(selector, (el: any) => el.value);
      if (value !== initials) {
        throw new Error(
          `Failed to set ${fieldName} — got "${value}" instead of "${initials}"`,
        );
      }
      console.log(`✏️  Verified ${fieldName} = "${value}"`);
    }

    // ── Small pause for any JS form validation to settle ────────────────────
    await new Promise((r) => setTimeout(r, 500));

    // ── Click submit ─────────────────────────────────────────────────────────
    await page.waitForSelector('input[name="claim"]', {
      visible: true,
      timeout: 5000,
    });
    console.log('🖱️  Clicking "Work this shift"...');
    await page.click('input[name="claim"]');

    // ── Poll for result instead of waitForNavigation ─────────────────────────
    // Same approach as login — poll until URL changes or success indicator appears
    const maxWait = 15000;
    const interval = 500;
    let elapsed = 0;
    const startUrl = page.url();

    while (elapsed < maxWait) {
      await new Promise((r) => setTimeout(r, interval));
      elapsed += interval;

      const currentUrl = page.url();
      const pageText = await page.evaluate(() =>
        document.body.innerText.toLowerCase(),
      );

      // Success — URL changed away from the claim page
      if (currentUrl !== startUrl) {
        console.log(`✅ Navigated to result page: ${currentUrl}`);

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
            throw new Error(
              `Signup may have failed — page contains: "${keyword}"`,
            );
          }
        }

        console.log('✅ Shift signup completed successfully');
        return;
      }

      // Still on same page — check for inline error messages
      const inlineError = await page.evaluate(() => {
        const el = document.querySelector('.error, .alert, .errorlist');
        return el ? el.textContent?.trim() : null;
      });

      if (inlineError) {
        throw new Error(`Signup form error: "${inlineError}"`);
      }
    }

    // If we get here, URL never changed — take a screenshot to diagnose
    await page.screenshot({ path: '/tmp/signup-timeout.png' });
    throw new Error(
      'Signup timed out — form submitted but page did not navigate',
    );
  } finally {
    releaseSignupLock();
  }
}
