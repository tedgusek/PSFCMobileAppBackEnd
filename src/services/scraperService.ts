import { getScrapePage, isSignupInProgress } from './browser';

export interface Shift {
  time: string;
  description: string;
  href: string;
}

export async function scrapeShifts(): Promise<Record<string, Shift[]>> {
  if (isSignupInProgress()) {
    console.log('⏸️  Scrape skipped — signup in progress');
    throw new Error('SIGNUP_IN_PROGRESS');
  }

  const page = getScrapePage();

  console.log('🔍 Scraping shifts...');
  await page.goto('https://members.foodcoop.com/services/shifts', {
    waitUntil: 'networkidle2',
  });

  let shiftsData: Record<string, Shift[]> = {};

  while (true) {
    console.log('🔍 Scraping shifts from:', page.url());

    const pageShifts = await page.evaluate(() => {
      const shiftsByDate: Record<
        string,
        { time: string; description: string; href: string }[]
      > = {};

      document.querySelectorAll('.col').forEach((col) => {
        const date =
          col.querySelector('b')?.textContent?.trim() || 'Unknown Date';

        const shifts = Array.from(col.querySelectorAll('a.shift')).map(
          (shift) => ({
            time: shift.querySelector('b')?.textContent?.trim() || 'Unknown',
            description: (shift.textContent || '')
              .replace(shift.querySelector('b')?.textContent || '', '')
              .replace(/\s+/g, ' ')
              .trim(),
            href: (shift.getAttribute('href') || '').trim(),
          }),
        );

        if (shifts.length > 0) {
          shiftsByDate[date] = shifts;
        }
      });

      return shiftsByDate;
    });

    for (const [date, shifts] of Object.entries(pageShifts)) {
      if (!shiftsData[date]) shiftsData[date] = [];
      shiftsData[date].push(...shifts);
    }

    const nextWeekHref = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find((a) =>
        a.textContent?.trim().startsWith('Next Week'),
      );
      return link ? (link.getAttribute('href') || '').trim() : null;
    });

    if (nextWeekHref) {
      console.log(`➡️ Moving to next week: ${nextWeekHref}`);
      await page.goto(`https://members.foodcoop.com${nextWeekHref}`, {
        waitUntil: 'networkidle2',
      });
    } else {
      console.log('✅ No more pages to scrape.');
      break;
    }
  }

  // Sort dates chronologically
  const sorted: Record<string, Shift[]> = {};
  for (const key of Object.keys(shiftsData).sort((a, b) => {
    const parse = (d: string) =>
      new Date(d.replace(/^[A-Za-z]+\s+/, '')).getTime();
    return parse(a) - parse(b);
  })) {
    sorted[key] = shiftsData[key];
  }

  return sorted;
}
