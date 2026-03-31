// Shared Yahoo Finance session (cookies + crumb)
// Cached per serverless instance — refreshes after 1 hour
const https = require('https');

let session = null;

function httpsGet(hostname, path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname,
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        ...extraHeaders,
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getSession() {
  if (session && Date.now() - session.ts < 3500000) return session; // ~1 hour

  // 1. Hit Yahoo Finance to collect session cookies
  const r1 = await httpsGet('finance.yahoo.com', '/', {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  });

  const cookies = (r1.headers['set-cookie'] || [])
    .map(c => c.split(';')[0])
    .join('; ');

  // 2. Exchange cookies for a crumb token
  const r2 = await httpsGet('query1.finance.yahoo.com', '/v1/test/getcrumb', {
    'Accept': 'text/plain,*/*',
    'Cookie': cookies,
  });

  const crumb = r2.body.trim();
  if (!crumb || crumb.length > 20 || crumb.includes('<')) {
    throw new Error('Could not obtain Yahoo Finance crumb');
  }

  session = { cookies, crumb, ts: Date.now() };
  return session;
}

async function yahooGet(hostname, path) {
  const sess = await getSession();
  const sep = path.includes('?') ? '&' : '?';
  return httpsGet(hostname, `${path}${sep}crumb=${encodeURIComponent(sess.crumb)}`, {
    'Accept': 'application/json',
    'Cookie': sess.cookies,
  });
}

module.exports = { yahooGet };
