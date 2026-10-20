const { defineConfig, devices } = require('@playwright/test');

const live = !!process.env.BASE_URL;
const baseURL = process.env.BASE_URL || 'http://localhost:8790/';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: live ? 1 : 0,
  reporter: [['list']],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: live ? undefined : {
    command: 'python3 -m http.server 8790',
    url: 'http://localhost:8790/',
    reuseExistingServer: true
  }
});
