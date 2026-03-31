const { yahooGet } = require('./_session');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const ticker = (req.query.ticker || '').replace(/[^A-Z0-9.\-]/g, '').toUpperCase();
  if (!ticker) return res.status(400).json({ error: 'Missing ticker' });

  // Try v7 quote first (lighter)
  try {
    const r = await yahooGet(
      'query1.finance.yahoo.com',
      `/v7/finance/quote?symbols=${ticker}&fields=targetMeanPrice,targetHighPrice,targetLowPrice,numberOfAnalystOpinions,recommendationKey`
    );
    if (r.status === 200) {
      const d = JSON.parse(r.body);
      const q = d?.quoteResponse?.result?.[0];
      if (q?.targetMeanPrice || q?.targetHighPrice || q?.targetLowPrice) {
        return res.json({
          low:      q.targetLowPrice          ?? null,
          mean:     q.targetMeanPrice         ?? null,
          high:     q.targetHighPrice         ?? null,
          analysts: q.numberOfAnalystOpinions ?? null,
          rec:      q.recommendationKey       ?? null,
        });
      }
    }
  } catch (_) {}

  // Fallback: quoteSummary financialData
  try {
    const r = await yahooGet(
      'query1.finance.yahoo.com',
      `/v10/finance/quoteSummary/${ticker}?modules=financialData`
    );
    const d = JSON.parse(r.body);
    const fd = d?.quoteSummary?.result?.[0]?.financialData;
    if (fd) {
      return res.json({
        low:      fd.targetLowPrice?.raw          ?? null,
        mean:     fd.targetMeanPrice?.raw         ?? null,
        high:     fd.targetHighPrice?.raw         ?? null,
        analysts: fd.numberOfAnalystOpinions?.raw ?? null,
        rec:      fd.recommendationKey            ?? null,
      });
    }
  } catch (_) {}

  res.json({ low: null, mean: null, high: null, analysts: null, rec: null });
};
