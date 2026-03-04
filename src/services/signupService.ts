import { getPage } from './browser';

/**
 * Navigates Puppeteer to the shift's signup URL and clicks the confirm button.
 *
 * @param href - The relative href from the shift link, e.g. "/services/shifts/signup/?id=12345"
 * @returns true if signup succeeded, throws if it failed
 */
export async function signUpForShift(href: string): Promise<void> {
  const page = getPage();
  if (!page) throw new Error('Browser not initialized');

  const signupUrl = `https://members.foodcoop.com${href}`;
  console.log(`🖱️  Navigating to signup page: ${signupUrl}`);

  await page.goto(signupUrl, { waitUntil: 'domcontentloaded' });

  // ── Check if we got redirected to login (session expired) ──────────────────
  if (page.url().includes('/login')) {
    throw new Error('SESSION_EXPIRED');
  }

  // ── Look for a confirmation/submit button on the signup page ───────────────
  // The foodcoop site typically has a form with a submit button to confirm.
  // We try a few common selectors in order of likelihood.
  const confirmSelectors = [
    'input[type="submit"]',
    'button[type="submit"]',
    'input[value="Sign Up"]',
    'input[value="Confirm"]',
    'button:contains("Sign Up")',
  ];

  let clicked = false;

  for (const selector of confirmSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.click(selector);
      clicked = true;
      console.log(`✅ Clicked confirm button with selector: ${selector}`);
      break;
    } catch {
      // Selector not found, try next
    }
  }

  if (!clicked) {
    // Take a screenshot so you can inspect what the page actually looks like
    await page.screenshot({ path: '/tmp/signup-debug.png' });
    throw new Error(
      'Could not find a confirm button on the signup page. ' +
        'Check /tmp/signup-debug.png for what the page looks like.',
    );
  }

  // ── Wait for navigation after clicking (confirmation redirect) ─────────────
  try {
    await page.waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 8000,
    });
  } catch {
    // Some sites don't navigate after submit — that's okay, continue
  }

  // ── Verify success by checking the resulting page ──────────────────────────
  const pageText = await page.evaluate(() => document.body.innerText);

  const failureKeywords = ['error', 'already signed up', 'unavailable', 'full'];
  const lowerText = pageText.toLowerCase();

  for (const keyword of failureKeywords) {
    if (lowerText.includes(keyword)) {
      throw new Error(`Signup may have failed — page contains: "${keyword}"`);
    }
  }

  console.log('✅ Shift signup completed successfully');
}
