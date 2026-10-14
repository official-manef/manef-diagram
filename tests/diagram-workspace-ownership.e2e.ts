import { expect, test } from '@playwright/test';
import { workspaceUrl } from '../src/lib/config/navigation';

test('all workspace addresses redirect to their MANEF owner and retain query state', async ({
	page,
	request
}) => {
	await page.goto('/embed/workspace');
	const paths = await page
		.locator('#workspace-navigation a')
		.evaluateAll((links) =>
			links
				.map((link) => new URL((link as HTMLAnchorElement).href).pathname)
				.filter((path) => path.startsWith('/embed/workspace'))
		);
	expect(paths).toHaveLength(11);
	for (const path of paths) {
		const suffix = path.slice('/embed/workspace'.length);
		const response = await request.get('/workspace' + suffix + '?preview=1', { maxRedirects: 0 });
		expect(response.status()).toBe(308);
		expect(response.headers().location).toBe(workspaceUrl(suffix.slice(1)) + '?preview=1');
	}
	expect((await request.get('/workspace/unknown', { maxRedirects: 0 })).status()).toBe(404);
	expect((await request.get('/embed/workspace/unknown')).status()).toBe(404);
});

test('embedded navigation keeps preview mode and the current navigation item', async ({ page }) => {
	await page.goto('/embed/workspace/diagram?preview=1');
	await expect(page.getByText(/This preview flag does not replace/)).toBeVisible();
	const toggle = page.getByRole('button', { name: 'Workspace navigation', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	const navigation = page.locator('#workspace-navigation');
	await navigation.getByRole('link', { name: 'Catalog', exact: true }).click();
	await expect(page).toHaveURL(/\/embed\/workspace\/registry\?preview=1$/);
	if (await toggle.isVisible()) await toggle.click();
	await expect(navigation.getByRole('link', { name: 'Catalog', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.goBack();
	await expect(page).toHaveURL(/\/embed\/workspace\/diagram\?preview=1$/);
	await expect(page.getByText(/This preview flag does not replace/)).toBeVisible();
});

test('storage denial keeps the embedded demo usable in memory', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() =>
		Object.defineProperty(window, 'localStorage', {
			get() {
				throw new DOMException('Storage blocked', 'SecurityError');
			}
		})
	);
	await page.goto('/embed/workspace');
	await expect(page.getByText(/This browser could not store the demo/)).toBeVisible();
	await page.getByLabel('Demo workspace', { exact: true }).selectOption('Sandbox');
	await expect(page.getByLabel('Demo workspace', { exact: true })).toHaveValue('Sandbox');
	await expect(page.getByText(/This browser could not store the demo/)).toBeVisible();
	expect(errors).toEqual([]);
});

for (const [name, saved] of [
	['missing graph and profile', { active: 'Product studio', workspaces: { 'Product studio': {} } }],
	['inherited active key', { active: 'constructor', workspaces: {} }]
] as const) {
	test(`malformed saved demo recovers: ${name}`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.addInitScript(
			(value) => localStorage.setItem('manef-ecosystem-demo-v1', JSON.stringify(value)),
			saved
		);
		await page.goto('/embed/workspace');
		await expect(page.getByLabel('Demo workspace', { exact: true })).toHaveValue('Product studio');
		await page.getByLabel('Demo workspace', { exact: true }).selectOption('Sandbox');
		await expect(page.getByLabel('Demo workspace', { exact: true })).toHaveValue('Sandbox');
		expect(errors).toEqual([]);
	});
}
