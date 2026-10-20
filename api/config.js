export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Vercel Environment Variable: Faqat NGROK_DOMAIN ishlatiladi
  const host = process.env.NGROK_DOMAIN || 'satisfy-endurance-mooned.ngrok-free.dev';
  const lanHost = process.env.LAN_HOST || '192.168.1.106:7777';

  return res.status(200).json({
    host,
    lanHost,
    lanUrl: `http://${lanHost}/desktop`
  });
}
