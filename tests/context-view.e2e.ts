import { expect, test } from '@playwright/test';

test('portable views restore graph and filters with arbitrary tag namespaces', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'clipboard', {
			value: {
				writeText: async (value: string) => {
					document.documentElement.dataset.sharedView = value;
				}
			}
		});
	});
	const graph = {
		schemaVersion: 1,
		nodes: [
			{
				id: 'shared',
				label: 'Shared context',
				tags: ['__proto__:safe', 'constructor:safe'],
				inputs: [],
				outputs: []
			}
		],
		edges: []
	};
	const params = new URLSearchParams({
		graph: JSON.stringify(graph),
		mode: 'graph',
		q: 'Shared context'
	});
	await page.goto(`/app?${params}`);
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('textbox', { name: 'Search graph' })).toHaveValue('Shared context');
	await expect(
		page.getByRole('application', { name: 'MANEF architecture graph canvas' })
	).toContainText('Shared context');
	await expect(page.getByRole('button', { name: 'Share view', exact: true })).toBeEnabled();
	await page.getByRole('button', { name: 'Share view', exact: true }).click();
	const shared = new URL((await page.locator('html').getAttribute('data-shared-view'))!);
	expect(shared.origin).toBe(new URL(page.url()).origin);
	expect(shared.pathname).toBe('/app');
	expect(JSON.parse(shared.searchParams.get('graph')!).nodes[0].id).toBe('shared');
	expect(errors).toEqual([]);
});

test('malformed shared graphs leave a usable default canvas', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/app?graph=invalid-json');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await expect(
		page.getByRole('application', { name: 'MANEF architecture graph canvas' })
	).toBeVisible();
	await expect(
		page.getByText('This shared graph link is invalid or too large. The default graph is shown.')
	).toBeVisible();
	expect(errors).toEqual([]);
});

test('the second activation opens the component diagram and can return', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/app');
	const diagram = page.getByRole('button', {
		name: 'diagram.manef.dev Interactive architecture + agent context graph',
		exact: true
	});
	await diagram.click();
	await page.getByRole('button', { name: 'Open component diagram', exact: true }).click();
	await expect(page.getByRole('navigation', { name: 'Diagram level' })).toBeVisible();
	await expect(page.getByRole('button', { name: /^Public directory/ }).first()).toBeVisible();
	await expect(page.getByRole('button', { name: /^Demo workspace/ }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Public map', exact: true }).click();
	await expect(page.getByRole('navigation', { name: 'Diagram level' })).toHaveCount(0);
	await expect(diagram).toBeVisible();
	expect(errors).toEqual([]);
});

test('nested JSON import reports depth rejection and keeps the current diagram', async ({
	page
}) => {
	await page.goto('/app');
	await page
		.getByRole('button', {
			name: 'diagram.manef.dev Interactive architecture + agent context graph',
			exact: true
		})
		.click();
	await page.getByRole('button', { name: 'Open component diagram', exact: true }).click();
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	const nested = (depth: number): object => ({
		schemaVersion: 1,
		nodes: [
			{
				id: `level-${depth}`,
				label: `Level ${depth}`,
				tags: [],
				inputs: [],
				outputs: [],
				...(depth ? { child: nested(depth - 1) } : {})
			}
		],
		edges: []
	});
	await page
		.getByRole('textbox', { name: 'Architecture graph JSON' })
		.fill(JSON.stringify(nested(3)));
	await page.getByRole('button', { name: 'Apply JSON', exact: true }).click();
	await expect(
		page.locator('#diagram-inspector').getByText(/invalid or exceeds 3 component levels/)
	).toBeVisible();
	await expect(page.getByText('JSON applied.', { exact: true })).toHaveCount(0);
	await expect(page.locator('.toast')).toHaveCSS('pointer-events', 'none');
	// Refresh deliberately replaces the rejected draft only after explicit discard.
	page.once('dialog', (dialog) => dialog.accept());
	await page.getByRole('button', { name: 'Refresh', exact: true }).click();
	await expect(page.getByRole('textbox', { name: 'Architecture graph JSON' })).toHaveValue(
		/Public directory/
	);
	await expect(page.getByRole('navigation', { name: 'Diagram level' })).toBeVisible();
});
