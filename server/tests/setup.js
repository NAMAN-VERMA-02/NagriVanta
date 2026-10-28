process.env.NODE_ENV = 'test';
// keep tests offline and deterministic even when .env holds real keys (dotenv never overrides set vars)
process.env.GEMINI_API_KEY = '';
