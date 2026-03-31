module.exports = async (req, res) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    res.json({ rate: data.rates.EUR });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
