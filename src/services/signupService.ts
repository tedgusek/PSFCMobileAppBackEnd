import { getPage } from './browser';

/**
 * Navigates Puppeteer to the shift signup page, fills in the 3 initials
 * fields exactly as seen on the foodcoop site, then clicks "Work this shift".
 *
 * Field names from the site's HTML:
 *   initials1 — "I am willing and able to meet all shift requirements"
 *   initials2 — "I will arrive at shift start time"
 *   initials4 — "I can cancel up until 8pm the night before"
 *
 * @param href     - Relative shift URL e.g. "/services/shifts/signup/?id=12345"
 * @param initials - The user's initials string e.g. "TG"
 */
export async function signUpForShift(
  href: string,
  initials: string,
): Promise<void> {
  const page = getPage();
  if (!page) throw new Error('Browser not initialized');

  const signupUrl = `https://members.foodcoop.com${href}`;
  console.log(`🖱️  Navigating to signup page: ${signupUrl}`);

  await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });

  // ── Session check ──────────────────────────────────────────────────────────
  if (page.url().includes('/login')) {
    throw new Error('SESSION_EXPIRED');
  }

  // ── Wait for the form to be present ───────────────────────────────────────
  try {
    await page.waitForSelector('form.mainform', { timeout: 8000 });
  } catch {
    await page.screenshot({ path: '/tmp/signup-debug.png' });
    throw new Error('Signup form not found on page. See /tmp/signup-debug.png');
  }

  // ── Fill in all 3 initials fields ─────────────────────────────────────────
  // Clear each field first in case it has a default value, then type initials
  const initialsFields = ['initials1', 'initials2', 'initials4'];

  for (const fieldName of initialsFields) {
    const selector = `input[name="${fieldName}"]`;
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector, { clickCount: 3 }); // Select all existing text
      await page.type(selector, initials);
      console.log(`✏️  Filled ${fieldName} with "${initials}"`);
    } catch {
      await page.screenshot({ path: '/tmp/signup-debug.png' });
      throw new Error(
        `Could not find initials field "${fieldName}". ` +
          'The form may have changed. See /tmp/signup-debug.png',
      );
    }
  }

  // ── Click the submit button ────────────────────────────────────────────────
  // From the HTML: <input class="btn btn-primary" type="submit" name="claim" value="Work this shift">
  try {
    await page.waitForSelector('input[name="claim"]', { timeout: 3000 });
    await page.click('input[name="claim"]');
    console.log('🖱️  Clicked "Work this shift" button');
  } catch {
    await page.screenshot({ path: '/tmp/signup-debug.png' });
    throw new Error(
      'Could not find the "Work this shift" submit button. See /tmp/signup-debug.png',
    );
  }

  // ── Wait for the page to respond after submission ─────────────────────────
  try {
    await page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 8000,
    });
  } catch {
    // Some form submissions don't trigger a full navigation — that's okay
  }

  // ── Verify success ────────────────────────────────────────────────────────
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
      await page.screenshot({ path: '/tmp/signup-debug.png' });
      throw new Error(`Signup may have failed — page contains: "${keyword}"`);
    }
  }

  console.log('✅ Shift signup completed successfully');
}
