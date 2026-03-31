const https = require('https');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

function get(hostname, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname, path, headers: HEADERS }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchWithRetry(ticker, attempt = 0) {
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const host = hosts[attempt % 2];
  const r = await get(host, `/v8/finance/chart/${ticker}?interval=1d&range=1d`);
  if (r.status === 429 && attempt < 3) {
    await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 800));
    return fetchWithRetry(ticker, attempt + 1);
  }
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return JSON.parse(r.body);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  try {
    const d = await fetchWithRetry(ticker);
    const m = d.chart.result[0].meta;
    const price  = m.regularMarketPrice;
    const prev   = m.chartPreviousClose ?? m.previousClose;
    const change = price - prev;
    res.json({ ticker, price, change, pct: (change / prev) * 100 });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
