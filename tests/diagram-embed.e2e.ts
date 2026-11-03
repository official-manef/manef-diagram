import { expect, test } from '@playwright/test';

function fixture() {
	return {
		format: 'manef-diagram',
		schemaVersion: 1,
		title: 'Embed fixture',
		metadata: { keep: true },
		graph: {
			schemaVersion: 1,
			nodes: [
				{
					id: 'baton',
					label: 'Baton',
					level: 0,
					tags: [],
					inputs: [],
					outputs: [{ id: 'out', label: 'Provides' }]
				},
				{
					id: 'manef',
					label: 'Manef Diagram',
					level: 1,
					tags: [],
					inputs: [{ id: 'in', label: 'Consumes' }],
					outputs: []
				}
			],
			edges: [
				{
					id: 'e1',
					source: 'baton',
					sourcePort: 'out',
					target: 'manef',
					targetPort: 'in',
					label: 'embeds'
				}
			]
		},
		ui: { diagramMode: 'flow', seeds: [], pan: { x: 0, y: 0 }, zoom: 1, positions: {} }
	};
}

function embedUrl() {
	return `/embed/diagram?mode=flow&graph=${encodeURIComponent(JSON.stringify(fixture().graph))}`;
}

test('the diagram embed restores a portable graph inside the frameable route', async ({ page }) => {
	await page.goto(embedUrl());
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await expect(page.locator('.node-select').first()).toContainText('Baton');
	await expect(page.locator('.node-select').nth(1)).toContainText('Manef Diagram');
});

test('embed responses frame-allow the owner product sites while the editor stays same-origin', async ({
	page
}) => {
	const embed = await page.request.get(embedUrl(page));
	expect(embed.ok()).toBe(true);
	const policy = embed.headers()['content-security-policy'] ?? '';
	expect(policy).toContain('https://batonly.site');
	expect(policy).toContain('https://review.batonly.site');

	const app = await page.request.get('/app');
	expect(app.headers()['x-frame-options']).toBe('SAMEORIGIN');
	expect(app.headers()['content-security-policy'] ?? '').not.toContain('batonly.site');
});
