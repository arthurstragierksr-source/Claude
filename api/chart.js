const { yahooGet } = require('./_session');

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function startDate(range) {
  const days = { '1mo': 35, '3mo': 95, '6mo': 185, '1y': 370, '2y': 740 };
  return Math.floor((Date.now() - (days[range] || 185) * 86400000) / 1000);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  const range  = ['1mo','3mo','6mo','1y','2y'].includes(req.query.range) ? req.query.range : '6mo';
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  const key = `${ticker}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return res.json(hit.data);

  try {
    const period1 = startDate(range);
    const period2 = Math.floor(Date.now() / 1000);
    const r = await yahooGet(
      'query1.finance.yahoo.com',
      `/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}&events=history`
    );
    if (r.status !== 200) throw new Error(`HTTP ${r.status}: ${r.body.slice(0, 100)}`);

    const d = JSON.parse(r.body);
    const result = d.chart.result[0];
    const timestamps = result.timestamp;
    const q = result.indicators.quote[0];

    const candles = timestamps.map((t, i) => ({
      time:   t,
      open:   q.open[i],
      high:   q.high[i],
      low:    q.low[i],
      close:  q.close[i],
      volume: q.volume[i] || 0,
    })).filter(c => c.open != null && c.close != null);

    if (!candles.length) throw new Error('No candle data returned');

    const payload = { ticker, candles };
    cache.set(key, { ts: Date.now(), data: payload });
    res.json(payload);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
