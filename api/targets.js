const https = require('https');

function get(options) {
  return new Promise((resolve, reject) => {
    const req = https.get(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  // Try v7 quote API first — simpler and more reliable
  try {
    const r = await get({
      hostname: 'query1.finance.yahoo.com',
      path: `/v7/finance/quote?symbols=${ticker}&fields=targetMeanPrice,targetHighPrice,targetLowPrice,numberOfAnalystOpinions,recommendationKey`,
      headers: HEADERS,
    });
    if (r.status === 200) {
      const d = JSON.parse(r.body);
      const q = d?.quoteResponse?.result?.[0];
      if (q?.targetMeanPrice || q?.targetHighPrice || q?.targetLowPrice) {
        return res.json({
          low:      q.targetLowPrice         ?? null,
          mean:     q.targetMeanPrice        ?? null,
          high:     q.targetHighPrice        ?? null,
          analysts: q.numberOfAnalystOpinions ?? null,
          rec:      q.recommendationKey      ?? null,
        });
      }
    }
  } catch (_) {}

  // Fallback: v10 quoteSummary
  try {
    const r = await get({
      hostname: 'query2.finance.yahoo.com',
      path: `/v10/finance/quoteSummary/${ticker}?modules=financialData`,
      headers: HEADERS,
    });
    const d = JSON.parse(r.body);
    const fd = d?.quoteSummary?.result?.[0]?.financialData;
    if (fd) {
      return res.json({
        low:      fd.targetLowPrice?.raw           ?? null,
        mean:     fd.targetMeanPrice?.raw          ?? null,
        high:     fd.targetHighPrice?.raw          ?? null,
        analysts: fd.numberOfAnalystOpinions?.raw  ?? null,
        rec:      fd.recommendationKey             ?? null,
      });
    }
  } catch (_) {}

  res.json({ low: null, mean: null, high: null, analysts: null, rec: null });
};
