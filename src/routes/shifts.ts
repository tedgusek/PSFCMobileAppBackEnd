import express from 'express';
import { getCachedShifts } from '../services/cached';
import { db } from '../db';
import { signUpForShift } from '../services/signupService';
import { login } from '../services/login';
import { triggerImmediateRescrape } from '../server';

const router = express.Router();

// ─── GET /api/shifts ──────────────────────────────────────────────────────────
// Returns cached shifts filtered to remove already-claimed ones.
// href is included so the frontend can pass it back when claiming.

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
// 1. Atomically locks the shift in the DB (prevents race conditions)
// 2. Uses Puppeteer to actually click the signup link on the foodcoop site
// 3. Confirms or rolls back the claim based on the result
//
// Body: { date, time, description, href, username }

router.post('/shifts/claim', async (req: any, res: any) => {
  const { date, time, description, href, username } = req.body;

  if (!date || !time || !description || !href || !username) {
    return res.status(400).json({
      error: 'Missing required fields: date, time, description, href, username',
    });
  }

  const shiftKey = `${date}|${time}|${description}`;

  // Step 1: Atomically lock — UNIQUE constraint means only first request wins
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

  // Step 2: Puppeteer clicks the actual signup link on the foodcoop site
  try {
    await signUpForShift(href);
  } catch (err: any) {
    console.error('❌ Puppeteer signup failed:', err.message);

    if (err.message === 'SESSION_EXPIRED') {
      console.log('🔄 Session expired — re-logging in and retrying...');
      try {
        await login();
        await signUpForShift(href);
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
      // Roll back so the shift remains available for others
      await db.query(`DELETE FROM shift_claims WHERE shift_key = $1`, [
        shiftKey,
      ]);
      return res.status(500).json({
        error:
          'Could not complete signup on the foodcoop site. Please try again.',
      });
    }
  }

  // Step 3: Mark confirmed in DB
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

  // Step 4: Fast rescrape so cache reflects the taken shift
  triggerImmediateRescrape();

  console.log(`✅ Shift signed up: ${shiftKey} by ${username}`);
  res.json({ success: true, message: 'You are signed up for this shift!' });
});

export const shiftsRouter = router;
