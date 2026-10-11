import { expect, test } from '@playwright/test';

test('public and demo headings retain hierarchy after CSS reset', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 1000 });
	for (const route of ['/', '/products', '/products/diagram', '/guide', '/audit', '/workspace']) {
		await page.goto(route);
		await expect(page.locator('h1').first()).toBeVisible();
		const style = await page
			.locator('h1')
			.first()
			.evaluate((heading) => {
				const css = getComputedStyle(heading);
				return { size: parseFloat(css.fontSize), weight: parseInt(css.fontWeight) };
			});
		expect(style.size, route).toBeGreaterThanOrEqual(28);
		expect(style.weight, route).toBeGreaterThanOrEqual(650);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
	}
});

test('desktop MCP guide has a compact sidebar, aligned content and numbered instructions', async ({
	page
}) => {
	for (const width of [1440, 1024]) {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto('/guide?section=mcp');
		await expect(page.getByRole('button', { name: 'Copy MCP endpoint' })).toBeEnabled();
		const nav = await page.getByRole('navigation', { name: 'Guide sections' }).boundingBox();
		const article = await page.locator('article').boundingBox();
		expect(nav!.width).toBe(200);
		expect(article!.width).toBeGreaterThan(nav!.width * 2);
		await expect(page.locator('main')).toHaveCSS('padding-left', '28px');
		await expect(page.locator('.mcp-connection > ol')).toHaveCSS('list-style-type', 'decimal');
		await expect(page.locator('.mcp-connection ul')).toHaveCSS('list-style-type', 'disc');
		await expect(page.getByRole('heading', { name: 'Troubleshooting' })).toHaveCSS(
			'font-size',
			'24px'
		);
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
	}
});
