import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: process.env.PORT || 3000,
  FOODCOOP_USERNAME: process.env.FOODCOOP_USERNAME,
  FOODCOOP_PASSWORD: process.env.FOODCOOP_PASSWORD,
  SESSION_FILE: 'session.json',
};
