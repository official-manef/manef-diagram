import { expect, test } from '@playwright/test';

const routes = [
	'/',
	'/app',
	'/products',
	'/guide',
	'/guide?section=mcp',
	'/audit',
	'/workspace',
	...['mso', 'diagram', 'registry', 'connectors', 'models', 'ops', 'docs', 'labs'].map(
		(id) => `/products/${id}`
	),
	...['navigation', 'identity', 'catalog'].map((id) => `/guide?section=${id}`),
	...[
		'mso',
		'diagram',
		'context',
		'registry',
		'models',
		'connectors',
		'ops',
		'developers',
		'labs',
		'settings'
	].map((id) => `/workspace/${id}`),
	...['dashboard', 'live-data', 'notes', 'assistant', 'settings'].map((id) => `/apps/${id}`)
];

test('all 33 main pages reflow on narrow phones', async ({ page }) => {
	test.setTimeout(120_000);
	for (const width of [320, 390]) {
		await page.setViewportSize({ width, height: 844 });
		for (const route of routes) {
			await page.goto(route);
			await expect(page.locator('h1').first()).toBeVisible();
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth),
				route
			).toBeLessThanOrEqual(width);
			if (route === '/audit') {
				const table = page.getByRole('table');
				expect((await table.boundingBox())!.width).toBeGreaterThanOrEqual(720);
				const scrollArea = await table.evaluate((el) => ({
					width: el.parentElement!.getBoundingClientRect().width,
					overflow: getComputedStyle(el.parentElement!).overflowX
				}));
				expect(scrollArea.width).toBeLessThanOrEqual(width);
				expect(scrollArea.overflow).toBe('auto');
			}
			if (!route.startsWith('/app')) {
				const sizes = await page
					.locator('button, .btn, .nav-item, .public-nav a')
					.evaluateAll((elements) =>
						elements
							.filter((el) => el.getBoundingClientRect().height > 0)
							.map((el) => el.getBoundingClientRect().height)
					);
				expect(
					sizes.every((height) => height >= 44),
					route
				).toBe(true);
			}
		}
	}
});

test('phone workspace navigation opens, closes and reaches the demo inspector', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/workspace');
	const navigation = page.getByRole('button', { name: 'Workspace navigation', exact: true });
	await expect(page.locator('#workspace-navigation')).toBeHidden();
	await expect(navigation).toBeEnabled();
	expect((await page.locator('h1').boundingBox())!.y).toBeLessThan(600);
	await navigation.click();
	await expect(navigation).toHaveAttribute('aria-expanded', 'true');
	await page
		.locator('#workspace-navigation')
		.getByRole('link', { name: 'Diagram', exact: true })
		.click();
	await expect(page.getByRole('heading', { name: 'Workspace diagram', exact: true })).toBeVisible();
	await expect(page.locator('#workspace-navigation')).toBeHidden();
	const node = page.locator('.demo-node').first();
	await node.focus();
	await node.press('Enter');
	await expect(node).toHaveClass(/selected/);
	const position = await node.getAttribute('style');
	const box = (await node.boundingBox())!;
	const touch = await page.context().newCDPSession(page);
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: box.x + 20, y: box.y + 20 }]
	});
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x: box.x + 20, y: box.y + 50 }]
	});
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await touch.detach();
	await expect(node).toHaveAttribute('style', position!);
	await page.getByRole('link', { name: 'Inspect selected node ↓' }).click();
	await expect(page).toHaveURL(/#demo-inspector$/);
	await page.getByRole('link', { name: 'Back to demo map ↑' }).click();
	await expect(page).toHaveURL(/#demo-map$/);
	await navigation.click();
	await navigation.press('Escape');
	await expect(navigation).toHaveAttribute('aria-expanded', 'false');
	await navigation.click();
	const search = page.getByRole('button', { name: 'Search · Ctrl K', exact: true });
	await search.click();
	const palette = page.getByRole('dialog', { name: 'Command palette', exact: true });
	await expect(palette).toBeVisible();
	await expect(palette.getByRole('link', { name: 'Audit', exact: true })).toHaveCount(1);
	const paletteBox = (await palette.boundingBox())!;
	expect(paletteBox.x).toBeGreaterThanOrEqual(0);
	expect(paletteBox.y).toBeGreaterThanOrEqual(0);
	expect(paletteBox.y + paletteBox.height).toBeLessThanOrEqual(720);
	await page.getByRole('textbox', { name: 'Search pages', exact: true }).fill('Guide');
	await expect(palette.getByRole('link', { name: 'Guide', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(palette).toBeHidden();
	await expect(search).toBeFocused();
	await page.getByRole('button', { name: 'Simulated support', exact: true }).click();
	const support = page.getByRole('complementary', { name: 'Simulated support', exact: true });
	await expect(support).toBeVisible();
	const supportBox = (await support.boundingBox())!;
	expect(supportBox.x).toBeGreaterThanOrEqual(0);
	expect(supportBox.x + supportBox.width).toBeLessThanOrEqual(320);
	await support.getByRole('button', { name: 'Close', exact: true }).click();
	await expect(support).toBeHidden();
});

test('landing keeps the MANEF studio style in both themes and sizes', async ({ page }) => {
	for (const width of [320, 390, 1440]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/');
		await expect(page.locator('.eco.studio')).toHaveCSS('background-color', 'rgb(244, 244, 247)');
		await expect(page.getByRole('link', { name: 'Start mapping', exact: true })).toHaveCSS(
			'border-radius',
			'0px'
		);
		await page.getByRole('button', { name: 'Dark', exact: true }).click();
		await expect(page.locator('.eco.studio')).toHaveCSS('background-color', 'rgb(23, 23, 25)');
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
			width
		);
		await page.getByRole('button', { name: 'Light', exact: true }).click();
	}
});
