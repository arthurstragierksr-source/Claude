const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname)));

// Proxy stock quote from Yahoo Finance
app.get('/api/quote/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) throw new Error('Yahoo Finance returned ' + response.status);
    const data = await response.json();
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose;
    const change = price - prev;
    const changePct = (change / prev) * 100;
    res.json({ ticker, price, change, changePct, prev });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Proxy USD→EUR exchange rate
app.get('/api/fx', async (req, res) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    res.json({ rate: data.rates.EUR });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  Stock Portfolio Tracker running at http://localhost:${PORT}\n`);
});
