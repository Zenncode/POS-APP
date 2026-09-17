import { defineConfig, devices } from '@playwright/test';

// Isolated E2E stack — strict loopback ports, never the dev ports
// (dev: API :3001, web :5173, postgres :5433, redis :6379).
const E2E_API_PORT = 3101;
const E2E_WEB_PORT = 5193;
const E2E_API_URL = `http://127.0.0.1:${E2E_API_PORT}`;
const E2E_WEB_URL = `http://127.0.0.1:${E2E_WEB_PORT}`;

// Explicit test-only credentials for the API webServer entry below.
// Playwright `env` wins over POS-API/.env (config/loadEnv only fills unset
// keys), so the dev DB can never leak in — and guard.mjs fail-closes anyway.
const E2E_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55433/pos_e2e?schema=public';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: E2E_WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: [
    {
      // Dedicated test API on :3101 (PORT_AUTO_FALLBACK=false => strict).
      command: 'pnpm --dir ../POS-API start:e2e',
      env: {
        PORT: String(E2E_API_PORT),
        PORT_AUTO_FALLBACK: 'false',
        NODE_ENV: 'test',
        DATABASE_URL: E2E_DB_URL,
        E2E_DATABASE_URL: E2E_DB_URL,
        E2E_EXPECT_DB: 'pos_e2e',
        E2E_EXPECT_PORT: String(E2E_API_PORT),
        REDIS_ENABLED: 'true',
        REDIS_URL: 'redis://127.0.0.1:56379',
        QUEUE_ENABLED: 'false',
        JWT_SECRET: 'e2e-test-secret-not-for-prod-use-only-0123456789',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'e2e-test-refresh-secret-not-for-prod-use-only-0123456789',
        JWT_REFRESH_EXPIRES_IN: '7d',
        BCRYPT_SALT_ROUNDS: '4',
        COOKIE_SECRET: 'e2e-test-cookie-secret-not-for-prod',
        ADMIN_SEED_EMAIL: '',
        ADMIN_SEED_PASSWORD: '',
        CORS_ORIGIN: E2E_WEB_URL,
        RATE_LIMIT_WINDOW_MS: '900000',
        RATE_LIMIT_MAX: '1000',
        SOCKET_AUTH_REQUIRED: 'true',
        LOW_STOCK_THRESHOLD: '5',
        // Explicit messaging fail-closes so inherited shell env or a real
        // .env can never cause external delivery during E2E:
        // - SMTP_* empty => email.service has no transporter => sendEmail
        //   returns { success: false } and the receipt endpoint answers 502.
        // - SMS_PROVIDER=twilio with empty creds => sms.service returns
        //   { success: false } (the 'mock' default would fake success).
        // Receipt EMAIL/SMS success paths are therefore explicitly untested;
        // specs assert only client-side validation + the failure toasts.
        SMS_PROVIDER: 'twilio',
        SMTP_HOST: '',
        SMTP_PORT: '587',
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_FROM: '',
        TWILIO_ACCOUNT_SID: '',
        TWILIO_AUTH_TOKEN: '',
        TWILIO_FROM_NUMBER: '',
        VONAGE_API_KEY: '',
        VONAGE_API_SECRET: '',
        VONAGE_FROM_NUMBER: '',
      },
      url: `${E2E_API_URL}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      // Dedicated test web on :5193, pointed ONLY at the test API above.
      // VITE_API_URL is read by app/lib/httpClient.ts; production vite.config.ts untouched.
      command: `pnpm dev --port ${E2E_WEB_PORT} --host 127.0.0.1 --strictPort`,
      env: {
        VITE_API_URL: E2E_API_URL,
        PORT: String(E2E_WEB_PORT),
      },
      url: `${E2E_WEB_URL}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
