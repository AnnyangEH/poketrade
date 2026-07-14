/* Vercel 서버리스 함수 — /api/price
   TODO: 실제 시세 소스(eBay 등) 연동 전까지는 목업 가격 배열을 반환한다. */
module.exports = (req, res) => {
  const q = (req.query && req.query.q) || '';
  const count = 5 + Math.floor(Math.random() * 5);
  const base = 1 + Math.random() * 8;
  const prices = Array.from({ length: count }, () =>
    Math.round((base + (Math.random() - 0.5) * 2) * 10) / 10
  ).filter(p => p > 0);

  res.status(200).json({ query: q, prices, mock: true });
};
