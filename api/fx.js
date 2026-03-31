const https = require('https');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  https.get('https://open.er-api.com/v6/latest/USD', yRes => {
    let raw = '';
    yRes.on('data', c => raw += c);
    yRes.on('end', () => {
      try {
        const d = JSON.parse(raw);
        res.json({ rate: d.rates.EUR });
      } catch (e) {
        res.status(502).json({ error: e.message });
      }
    });
  }).on('error', e => res.status(502).json({ error: e.message }));
};
