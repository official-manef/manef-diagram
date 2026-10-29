import { defineConfig, devices } from '@playwright/test';
import { browserLaunchOptions } from './playwright.config';
export default defineConfig({
	testMatch: '**/notes-isolation.browser.ts',
	outputDir: 'test-results/notes',
	webServer: {
		command: 'bun x vite --config tests/fixtures/notes/vite.config.ts',
		url: 'http://127.0.0.1:4198',
		reuseExistingServer: false
	},
	use: {
		baseURL: 'http://127.0.0.1:4198',
		trace: 'retain-on-failure',
		launchOptions: browserLaunchOptions
	},
	projects: [
		{ name: 'desktop', use: devices['Desktop Chrome'] },
		{ name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
	]
});
