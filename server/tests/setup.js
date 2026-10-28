process.env.NODE_ENV = 'test';
// Keep tests offline and deterministic even when .env holds real keys (dotenv never overrides set vars).
process.env.GEMINI_API_KEY = '';
process.env.RISK_WEATHER = 'off';
process.env.AUTO_ASSIGN = 'false'; // the lifecycle test walks the manual path; auto-routing has its own test
process.env.OPEN311_API_KEYS = 'test-open311-key';
process.env.CRON_SECRET = 'test-cron-secret';
process.env.WEBHOOK_URL = '';
