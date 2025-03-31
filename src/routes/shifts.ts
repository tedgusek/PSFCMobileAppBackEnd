import express from 'express';
import { scrapeShifts } from '../services/scraperService';

const router = express.Router();

// router.get('/shifts', async (req, res) => {
//   try {
//     const shifts = await scrapeShifts();
//     res.json({ shifts });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

router.get('/shifts', async (req, res) => {
  try {
    const shifts = await scrapeShifts();
    res.json({ shifts });
  } catch (error) {
    const errMsg = (error as Error).message || 'An unknown error occurred';
    res.status(500).json({ error: errMsg });
  }
});

export default router;
