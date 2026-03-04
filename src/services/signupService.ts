import { getSignupPage, lockForSignup, releaseSignupLock } from './browser';
import { loginSignupPage } from './login';

export async function signUpForShift(
  href: string,
  initials: string,
): Promise<void> {
  const page = getSignupPage();
  lockForSignup();

  try {
    const signupUrl = `https://members.foodcoop.com${href}`;
    console.log(`🖱️  Navigating signup page to: ${signupUrl}`);

    await page.goto(signupUrl, { waitUntil: 'networkidle2' });

    // Re-login if session expired
    if (page.url().includes('/login')) {
      console.log('🔐 Signup page session expired — logging in...');
      await loginSignupPage();
      await page.goto(signupUrl, { waitUntil: 'networkidle2' });
    }

    // Wait for form
    await page.waitForSelector('form.mainform', { timeout: 10000 });
    console.log('📋 Signup form found');

    // Fill each initials field with verification
    for (const fieldName of ['initials1', 'initials2', 'initials4']) {
      const selector = `input[name="${fieldName}"]`;
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      await page.click(selector, { clickCount: 3 });
      await page.type(selector, initials, { delay: 50 });

      const value = await page.$eval(selector, (el: any) => el.value);
      if (value !== initials) {
        throw new Error(
          `Failed to set ${fieldName} — got "${value}" not "${initials}"`,
        );
      }
      console.log(`✏️  Verified ${fieldName} = "${value}"`);
    }

    await new Promise((r) => setTimeout(r, 500));

    // Click submit and wait for navigation
    await page.waitForSelector('input[name="claim"]', {
      visible: true,
      timeout: 5000,
    });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('input[name="claim"]'),
    ]);

    console.log('🖱️  Clicked "Work this shift" — page navigated');

    // Check result page for errors
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
        throw new Error(`Signup may have failed — page contains: "${keyword}"`);
      }
    }

    console.log('✅ Shift signup completed successfully');
  } finally {
    releaseSignupLock();
  }
}
