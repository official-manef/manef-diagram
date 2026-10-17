import { expect, test } from '@playwright/test';
import { siteLinks } from '../src/lib/config/navigation';

test('only the public demo permits framing by the approved MANEF hosts', async ({ request }) => {
	const embed = await request.get('/embed/workspace');
	expect(embed.headers()['content-security-policy']).toBe(
		`frame-ancestors 'self' ${siteLinks.ecosystemOrigin} https://staging.manef.dev`
	);
	expect(embed.headers()['x-frame-options']).toBeUndefined();
	expect(await embed.text()).toContain('noindex');
	const notes = await request.get('/apps/notes');
	expect(notes.headers()['x-frame-options']).toBe('SAMEORIGIN');
	expect(notes.headers()['cache-control']).toContain('no-store');
});

test('theme preference follows public pages, the editor and private app chrome', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/apps/notes');
	await expect(page.getByRole('button', { name: 'Toggle color theme', exact: true })).toBeEnabled();
	await page.goto('/');
	await page.getByRole('button', { name: 'Dark', exact: true }).click();
	for (const route of [
		'/products',
		'/guide?section=mcp',
		'/audit',
		'/app',
		'/apps/notes',
		'/apps/settings'
	]) {
		await page.goto(route);
		await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
		await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
		if (route === '/app')
			await expect(page.locator('.workspace')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			390
		);
	}
	await page.getByRole('button', { name: 'Toggle color theme', exact: true }).click();
	await page.goto('/app');
	await expect(page.locator('.workspace')).toHaveCSS('background-color', 'rgb(244, 244, 247)');
	await page
		.getByRole('combobox', { name: 'Color theme', exact: true })
		.selectOption('composio-dark');
	await page.goto('/guide');
	await expect(page.locator('.eco')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
	await page.getByRole('button', { name: 'Light', exact: true }).click();
	await page.goto('/apps/notes');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('blocked storage does not break editor hydration or controls', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() =>
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('Storage blocked', 'SecurityError');
			}
		})
	);
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Canvas', exact: true })).toBeEnabled();
	await page
		.getByRole('combobox', { name: 'Color theme', exact: true })
		.selectOption('composio-dark');
	await expect(page.locator('.workspace')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
});
