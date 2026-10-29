import { expect, test, type Page } from '@playwright/test';
import {
	buildDiagramViewUrl,
	runGraphTool,
	traceGraph
} from '../slices/architecture-inventory/core';
import type { ArchitectureGraph } from '../slices/architecture-inventory/core';

function fixture(): ArchitectureGraph {
	return {
		schemaVersion: 1,
		nodes: Object.entries({ a: 'Alpha', b: 'Beta', c: 'Other' }).map(([id, label]) => ({
			id,
			label,
			tags: [],
			inputs: [],
			outputs: []
		})),
		edges: []
	};
}
async function clipboard(page: Page) {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: async (value: string) => {
					document.documentElement.dataset.sharedView = value;
				}
			}
		});
	});
}
async function shared(page: Page) {
	await page.getByRole('button', { name: 'Share view', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-shared-view', /seed=/);
	return new URL((await page.locator('html').getAttribute('data-shared-view'))!);
}
for (const context of ['root', 'component']) {
	test(`agent ${context} multi-seed focus agrees with the core and survives share/reload`, async ({
		page,
		baseURL
	}) => {
		await clipboard(page);
		const graph = fixture();
		const parent: ArchitectureGraph = {
			schemaVersion: 1,
			nodes: [{ id: 'parent', label: 'Parent', tags: [], inputs: [], outputs: [], child: graph }],
			edges: []
		};
		const url =
			context === 'root'
				? (
						runGraphTool(
							graph,
							[],
							'graph_create_portable_view',
							{ graph, seeds: ['a', 'b'], focus: true, mode: 'flow', trace: 'direct' },
							baseURL
						) as { url: string }
					).url
				: buildDiagramViewUrl(
						{
							graph: parent,
							open: ['parent'],
							seeds: ['a', 'b'],
							focus: true,
							mode: 'flow',
							trace: 'direct'
						},
						baseURL
					);
		expect(traceGraph(graph, ['a', 'b'], 'direct').nodeIds).toEqual(['a', 'b']);
		await page.goto(url);
		await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
		await expect(page.locator('.metric').filter({ hasText: 'Services' })).toContainText('2 of 3');
		await expect(
			page.getByRole('heading', { name: '2 nodes selected', exact: true })
		).toBeVisible();
		await expect(page.locator('.node')).toHaveCount(2);
		const result = await shared(page);
		expect(result.searchParams.getAll('seed')).toEqual(['a', 'b']);
		expect(result.searchParams.getAll('open')).toEqual(context === 'root' ? [] : ['parent']);
		await page.reload();
		await expect(page.locator('.metric').filter({ hasText: 'Services' })).toContainText('2 of 3');
		await expect(
			page.getByRole('heading', { name: '2 nodes selected', exact: true })
		).toBeVisible();
	});
}

test('hover emphasis does not remove another selected focus seed', async ({ page, baseURL }) => {
	// Hover is a desktop input; keep the renderer above its non-interactive overview scale.
	await page.setViewportSize({ width: 1440, height: 900 });
	const graph = fixture();
	await page.goto(
		buildDiagramViewUrl(
			{ graph, seeds: ['a', 'b'], focus: true, mode: 'graph', trace: 'direct' },
			baseURL
		)
	);
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	if (page.viewportSize()!.width <= 1024)
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
	await page.locator('.viewport').scrollIntoViewIfNeeded();
	await expect(page.locator('.dot')).toHaveCount(2);
	await page.locator('.dot-hit').first().hover();
	await expect(page.locator('.dot')).toHaveCount(2);
	await expect(page.locator('.metric').filter({ hasText: 'Services' })).toContainText('2 of 3');
});

test('stale and repeated URL seeds are ignored without losing later valid seeds', async ({
	page,
	baseURL
}) => {
	await clipboard(page);
	await page.goto(
		buildDiagramViewUrl(
			{ graph: fixture(), seeds: ['missing', 'b', 'b'], focus: true, mode: 'flow' },
			baseURL
		)
	);
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await expect(page.locator('.metric').filter({ hasText: 'Services' })).toContainText('1 of 3');
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('Beta');
	expect((await shared(page)).searchParams.getAll('seed')).toEqual(['b']);
});

test('oversized multilingual share fails before clipboard or history mutation', async ({
	page
}) => {
	await clipboard(page);
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	const originalUrl = page.url();
	await page.getByRole('textbox', { name: 'Search graph', exact: true }).fill('界'.repeat(2000));
	await page.getByRole('button', { name: 'Share view', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('size limit');
	await expect(page.locator('html')).not.toHaveAttribute('data-shared-view');
	expect(page.url()).toBe(originalUrl);
});
