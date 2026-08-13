import Database from './lib/db/index.js';
import { nepalDateString } from './lib/report-dates.js';

const db = Database.getInstance();
if (typeof db.connect === 'function') await db.connect();
else if (typeof db.init === 'function') await db.init();

const today = nepalDateString(new Date());
const y = nepalDateString(new Date(Date.now() - 86400000));
const utc = await db.get(`SELECT date('now') as d, datetime('now') as t`);
const pay = await db.all(`
  SELECT id, amount, created_at,
         date(created_at) as d_utc,
         date(datetime(created_at, '+5 hours', '+45 minutes')) as d_npt
  FROM bill_payments ORDER BY id DESC LIMIT 8`);
const bills = await db.all(`
  SELECT id, bill_number, grand_total, status, paid_at, created_at,
         date(COALESCE(paid_at, created_at)) as d_utc,
         date(datetime(COALESCE(paid_at, created_at), '+5 hours', '+45 minutes')) as d_npt
  FROM bills ORDER BY id DESC LIMIT 8`);
const salesUtc = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM bill_payments WHERE date(created_at)=?`, [today]);
const salesNpt = await db.get(`SELECT COALESCE(SUM(amount),0) as total FROM bill_payments WHERE date(datetime(created_at, '+5 hours', '+45 minutes'))=?`, [today]);
const ordersUtc = await db.get(`SELECT COUNT(*) as c FROM orders WHERE date(created_at)=? AND COALESCE(status,'')!='cancelled'`, [today]);
const ordersNpt = await db.get(`SELECT COUNT(*) as c FROM orders WHERE date(datetime(created_at, '+5 hours', '+45 minutes'))=? AND COALESCE(status,'')!='cancelled'`, [today]);
console.log(JSON.stringify({ today, y, utc, salesUtc, salesNpt, ordersUtc, ordersNpt, pay, bills }, null, 2));
process.exit(0);
