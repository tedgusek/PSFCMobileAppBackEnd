import express from 'express';
import { getCachedShifts } from '../services/cached';
import { db } from '../db';
import { signUpForShift } from '../services/signupService';
import { login } from '../services/login';
import { triggerImmediateRescrape } from '../server';

const router = express.Router();

// ─── GET /api/shifts ──────────────────────────────────────────────────────────

router.get('/shifts', async (_req: any, res: any) => {
  try {
    const data = getCachedShifts();

    if (!data || Object.keys(data).length === 0) {
      return res
        .status(503)
        .json({
          error: 'Shift data not available yet. Please try again in a moment.',
        });
    }

    const claimedResult = await db.query(
      `SELECT shift_key FROM shift_claims WHERE status = 'confirmed'`,
    );
    const claimedSet = new Set<string>(
      claimedResult.rows.map((r: any) => r.shift_key),
    );

    const filtered: Record<
      string,
      { time: string; description: string; href: string }[]
    > = {};

    for (const [date, shifts] of Object.entries(data)) {
      const available = shifts.filter(
        (s) => !claimedSet.has(`${date}|${s.time}|${s.description}`),
      );
      if (available.length > 0) {
        filtered[date] = available;
      }
    }

    res.json(filtered);
  } catch (err) {
    console.error('❌ Error fetching shifts:', err);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

// ─── POST /api/shifts/claim ───────────────────────────────────────────────────
// Body: { date, time, description, href, initials, username }

router.post('/shifts/claim', async (req: any, res: any) => {
  const { date, time, description, href, initials, username } = req.body;

  if (!date || !time || !description || !href || !initials || !username) {
    return res.status(400).json({
      error:
        'Missing required fields: date, time, description, href, initials, username',
    });
  }

  // Validate initials — must be 2-3 letters only
  if (!/^[A-Za-z]{2,3}$/.test(initials)) {
    return res
      .status(400)
      .json({ error: 'Initials must be 2–3 letters (e.g. "TG" or "TJG").' });
  }

  const shiftKey = `${date}|${time}|${description}`;

  // Step 1: Atomically lock the shift in the DB
  try {
    await db.query(
      `INSERT INTO shift_claims (shift_key, claimed_by, status) VALUES ($1, $2, 'pending')`,
      [shiftKey, username],
    );
  } catch (err: any) {
    if (err.code === '23505') {
      return res
        .status(409)
        .json({ error: 'Sorry, this shift was just claimed by someone else.' });
    }
    console.error('❌ DB error during claim insert:', err);
    return res.status(500).json({ error: 'Database error. Please try again.' });
  }

  // Step 2: Puppeteer fills initials and submits the form
  try {
    await signUpForShift(href, initials.toUpperCase());
  } catch (err: any) {
    console.error('❌ Puppeteer signup failed:', err.message);

    if (err.message === 'SESSION_EXPIRED') {
      console.log('🔄 Session expired — re-logging in and retrying...');
      try {
        await login();
        await signUpForShift(href, initials.toUpperCase());
      } catch (retryErr: any) {
        console.error('❌ Retry after re-login also failed:', retryErr.message);
        await db.query(`DELETE FROM shift_claims WHERE shift_key = $1`, [
          shiftKey,
        ]);
        return res
          .status(500)
          .json({ error: 'Signup failed after re-login. Please try again.' });
      }
    } else {
      await db.query(`DELETE FROM shift_claims WHERE shift_key = $1`, [
        shiftKey,
      ]);
      return res.status(500).json({
        error:
          'Could not complete signup on the foodcoop site. Please try again.',
      });
    }
  }

  // Step 3: Confirm in DB
  try {
    await db.query(
      `UPDATE shift_claims SET status = 'confirmed' WHERE shift_key = $1`,
      [shiftKey],
    );
  } catch (err) {
    console.error(
      '❌ Failed to confirm claim in DB (signup still occurred):',
      err,
    );
  }

  // Step 4: Fast rescrape
  triggerImmediateRescrape();

  console.log(`✅ Shift signed up: ${shiftKey} by ${username}`);
  res.json({ success: true, message: 'You are signed up for this shift!' });
});

export const shiftsRouter = router;
