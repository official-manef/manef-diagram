import { expect, test } from '@playwright/test';

async function expectNoOverflow(page: import('@playwright/test').Page) {
	const size = await page.evaluate(() => ({
		client: document.documentElement.clientWidth,
		scroll: document.documentElement.scrollWidth
	}));
	expect(size.scroll).toBe(size.client);
}

test('320px phone retains graph controls, canvas navigation and inspector editing', async ({
	page
}) => {
	await page.setViewportSize({ width: 844, height: 390 });
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await expect(page.getByRole('navigation', { name: 'Phone diagram controls' })).toBeVisible();
	await expectNoOverflow(page);
	await page.setViewportSize({ width: 320, height: 720 });
	await expectNoOverflow(page);
	for (const name of ['+ Node', 'Export', 'Import', 'Share view']) {
		const box = await page.getByRole('button', { name, exact: true }).boundingBox();
		expect(box!.height).toBeGreaterThanOrEqual(44);
		expect(box!.x + box!.width).toBeLessThanOrEqual(320);
	}
	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Tag filters' })).toBeVisible();
	await page.getByRole('textbox', { name: 'Filter tags' }).fill('vercel');
	await page.getByRole('checkbox').first().check();
	await expectNoOverflow(page);
	await page.getByRole('button', { name: 'Clear', exact: true }).click();
	await page.getByRole('button', { name: 'Filter', exact: true }).click();
	await page.getByRole('button', { name: 'All connected', exact: true }).click();
	await page.getByRole('button', { name: 'Direct', exact: true }).click();
	await page.locator('.mobile-edge').first().click();
	await page.getByRole('link', { name: 'Edit connection', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Connection details' })).toBeVisible();
	await page.getByLabel('Label', { exact: true }).fill('Phone connection');
	await page.getByRole('link', { name: 'Back to map ↑' }).click();
	await page.getByRole('button', { name: 'mso.manef.dev Manef Shell OS', exact: true }).click();
	await page.getByRole('link', { name: 'Edit mso.manef.dev', exact: true }).click();
	await page.getByRole('button', { name: 'Use output', exact: true }).click();
	await page.getByRole('link', { name: 'Back to map ↑' }).click();
	await page
		.getByRole('button', { name: 'models.manef.dev Model catalog and routing', exact: true })
		.click();
	await page.getByRole('link', { name: 'Edit models.manef.dev', exact: true }).click();
	await page.getByRole('button', { name: 'Connect', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('Connection added.');
	await page.getByRole('button', { name: 'Cancel connection', exact: true }).click();
	await page.getByRole('link', { name: 'Back to map ↑' }).click();
	await page.getByRole('button', { name: 'Focus: Off', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Focus: On' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Focus: On' }).click();
	await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await expect(page.locator('.world')).toBeVisible();
	await expectNoOverflow(page);
	await page.locator('.viewport').scrollIntoViewIfNeeded();
	const before = await page.locator('.world').getAttribute('style');
	const canvas = await page.locator('.viewport').boundingBox();
	await page.mouse.move(canvas!.x + 10, canvas!.y + 110);
	await page.mouse.down();
	await page.mouse.move(canvas!.x + 45, canvas!.y + 145);
	await page.mouse.up();
	await expect(page.locator('.world')).not.toHaveAttribute('style', before!);
	const touch = await page.context().newCDPSession(page);
	const beforeTouch = await page.locator('.world').getAttribute('style');
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchStart',
		touchPoints: [{ x: canvas!.x + 10, y: canvas!.y + 110 }]
	});
	await touch.send('Input.dispatchTouchEvent', {
		type: 'touchMove',
		touchPoints: [{ x: canvas!.x + 45, y: canvas!.y + 145 }]
	});
	await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect(page.locator('.world')).not.toHaveAttribute('style', beforeTouch!);
	await touch.detach();
	await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
	await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
	await page.getByRole('button', { name: 'Fit', exact: true }).click();
	await page.getByRole('button', { name: 'Graph', exact: true }).click();
	await page.getByRole('button', { name: 'Physics', exact: true }).click();
	await expect(page.getByRole('slider', { name: 'Repel', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Layers', exact: true }).click();
	await expectNoOverflow(page);
	await page.getByRole('button', { name: 'Physics', exact: true }).click();
	await page.getByRole('textbox', { name: 'Search graph' }).fill('no-such-service');
	await expect(page.getByText('No services match', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Clear search and tags', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Search graph' })).toHaveValue('');
	await expect(page.locator('.world')).toBeVisible();
	await page.getByRole('button', { name: 'List', exact: true }).click();
	await expect(page.locator('.world')).toBeHidden();
	await page.getByRole('textbox', { name: 'Search graph' }).fill('no-such-service');
	await expect(page.getByText('No services match', { exact: false })).toBeVisible();
	await expectNoOverflow(page);
	await page.getByRole('button', { name: 'Clear search and tags', exact: true }).click();
	await expect(page.locator('.mobile-card').first()).toBeVisible();
});

test('long imported phone names, JSON, exports and added views stay contained', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/app');
	const label = 'ServiceWithoutAnySpaces'.repeat(8);
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	const graph = {
		schemaVersion: 1,
		nodes: [{ id: 'phone', label, tags: [], inputs: [], outputs: [] }],
		edges: []
	};
	await page.locator('input[type="file"]').setInputFiles({
		name: 'phone.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(graph))
	});
	await page.locator('.mobile-card').click();
	await expectNoOverflow(page);
	await page.getByRole('link', { name: `Edit ${label}`, exact: true }).click();
	await page.getByLabel('Label', { exact: true }).fill('Phone service');
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Architecture graph JSON' })).toHaveValue(
		/Phone service/
	);
	const download = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export', exact: true }).click();
	expect((await download).suggestedFilename()).toMatch(/\.json$/);
	await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await page.getByLabel('Add view').selectOption({ label: 'Flowchart' });
	await expect(page.locator('.view-canvas svg')).toBeVisible();
	await expectNoOverflow(page);
	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await page.getByRole('button', { name: 'List', exact: true }).click();
	await expect(page.locator('.mobile-card')).toBeVisible();
});

test('landing and guide explain the real MCP transport and copy its endpoint', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: async (value: string) => {
					document.documentElement.dataset.copiedMcp = value;
				}
			}
		});
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Copy MCP endpoint' }).click();
	await expect(page.getByRole('status')).toHaveText('Endpoint copied.');
	await expect(page.locator('html')).toHaveAttribute(
		'data-copied-mcp',
		'https://architecture.manef.dev/api/mcp/server'
	);
	await page.getByText('10 read-only graph tools', { exact: true }).click();
	await expect(page.getByText('graph_create_portable_view', { exact: true })).toBeVisible();
	await expectNoOverflow(page);
	await page.getByRole('link', { name: 'Read the MCP guide' }).click();
	await expect(
		page.getByRole('heading', { name: 'Connect to the Diagram MCP server' })
	).toBeVisible();
	await expect(page.getByText('401 means', { exact: false })).toBeVisible();
	await page.getByText('Set up Codex with the new token', { exact: true }).click();
	await page.getByRole('button', { name: 'Copy Codex configuration' }).click();
	await expect(page.getByRole('status')).toHaveText('Codex configuration copied.');
	await expect(page.locator('html')).toHaveAttribute(
		'data-copied-mcp',
		'[mcp_servers.diagram]\nurl = "https://architecture.manef.dev/api/mcp/server"\nbearer_token_env_var = "MCP_DIAGRAM_TOKEN"'
	);
	await expectNoOverflow(page);
});

test('MCP copy denial offers a manual endpoint without claiming success', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: async () => {
					throw new Error('Clipboard denied');
				}
			}
		});
	});
	await page.goto('/guide?section=mcp');
	await page.getByRole('button', { name: 'Copy MCP endpoint' }).click();
	await expect(page.getByRole('status')).toContainText('Copy was blocked.');
	await expect(page.getByLabel('MCP endpoint')).toHaveValue(
		'https://architecture.manef.dev/api/mcp/server'
	);
	await page.getByText('Set up Codex with the new token', { exact: true }).click();
	await page.getByRole('button', { name: 'Copy Codex configuration' }).click();
	await expect(page.getByRole('status')).toContainText('Copy was blocked.');
	await expect(page.getByLabel('Codex MCP configuration (no token included)')).toHaveValue(
		/bearer_token_env_var = "MCP_DIAGRAM_TOKEN"/
	);
});
