import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function chunk(source: string) {
	const manifest = JSON.parse(
		await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8')
	);
	return '/' + manifest[source].file;
}

for (const engine of ['pele', 'mermaid'] as const) {
	test(`${engine}: authored markup is inert after sanitization`, async ({ page }) => {
		const remote: string[] = [];
		await page.route('https://example.invalid/**', async (route) => {
			remote.push(route.request().url());
			await route.abort();
		});
		if (engine === 'mermaid') {
			const pele = await chunk('node_modules/pele/dist/pele.js');
			await page.route('**' + pele, (route) => route.abort());
		}
		await page.addInitScript(() => {
			(window as Window & { __svgXss?: boolean }).__svgXss = false;
		});
		await page.goto('/app');
		await expect(page.getByRole('button', { name: 'Diagram type', exact: true })).toBeEnabled();
		await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
		await page.getByRole('listbox', { name: 'Diagram types', exact: true }).press('Home');
		await expect(page.locator('.view-canvas')).toHaveAttribute('data-renderer', engine);
		await page.getByRole('listbox', { name: 'Diagram types' }).press('Escape');
		// Load an explicitly authored view rather than relying on compiler escaping.
		const graph = {
			schemaVersion: 1,
			nodes: [
				{
					id: 'unsafe',
					label: 'Unsafe source',
					tags: [],
					inputs: [],
					outputs: [],
					views: [
						{
							id: 'x',
							kind: 'flowchart',
							title: 'Unsafe view',
							format: 'md',
							source:
								'flowchart LR\nA["<img src=https://example.invalid/x onerror=window.__svgXss=true>"] --> B[Safe]'
						}
					]
				}
			],
			edges: []
		};
		await page.locator('input[type="file"]').setInputFiles({
			name: 'unsafe.json',
			mimeType: 'application/json',
			buffer: Buffer.from(
				JSON.stringify({
					format: 'manef-diagram',
					schemaVersion: 1,
					title: 'Security',
					graph,
					ui: { seeds: ['unsafe'] }
				})
			)
		});
		await expect(page.getByRole('status')).toHaveText('Imported unsafe.json.');
		await page.getByRole('button', { name: 'Unsafe view', exact: true }).click();
		await expect(page.locator('.view-canvas')).toHaveAttribute('data-renderer', engine);
		await expect(page.locator('.view-canvas svg')).toBeVisible();
		if (engine === 'mermaid') {
			const presentation = await page
				.locator('.view-canvas .node rect')
				.first()
				.evaluate((node) => ({
					fill: (node as SVGElement).style.fill,
					stroke: (node as SVGElement).style.stroke
				}));
			expect(presentation.fill).not.toBe('');
			expect(presentation.stroke).not.toBe('');
		}
		await expect(
			page.locator(
				'.view-canvas script, .view-canvas image, .view-canvas img, .view-canvas foreignObject, .view-canvas [onerror], .view-canvas [onload], .view-canvas style'
			)
		).toHaveCount(0);
		expect(remote).toEqual([]);
		expect(await page.evaluate(() => (window as Window & { __svgXss?: boolean }).__svgXss)).toBe(
			false
		);
	});
}

test('SVG boundary strips scripts, CSS leaks, external resources and animation', async ({
	page
}) => {
	await page.goto('/app');
	const path = await chunk('slices/architecture-inventory/lib/diagram-svg.ts');
	const result = await page.evaluate(async (path) => {
		const { sanitizeDiagramSvg } = await import(/* @vite-ignore */ path);
		const fragment = sanitizeDiagramSvg(
			`<svg xmlns="http://www.w3.org/2000/svg" onload="window.__svgXss=true"><style>body{background:red} text{fill:blue} .bad{fill:url(https://example.invalid/x)}</style><script>window.__svgXss=true</script><foreignObject><img src="https://example.invalid/x" onerror="window.__svgXss=true"/></foreignObject><image href="https://example.invalid/x"/><a href="javascript:alert(1)"><text>link</text></a><animate attributeName="href" to="https://example.invalid/x"/><text class="bad" style="background:url(https://example.invalid/x);fill:green" onclick="alert(1)">Safe text</text><text id="styled">Styled</text><path marker-end="url(#arrow)" d="M0 0L10 10"/></svg>`
		);
		const host = document.createElement('div');
		host.append(fragment);
		return {
			html: host.innerHTML,
			text: host.textContent,
			styleTags: host.querySelectorAll('style').length,
			marker: host.querySelector('path')?.getAttribute('marker-end'),
			styledFill: (host.querySelector('#styled') as SVGElement | null)?.style.fill
		};
	}, path);
	expect(result.html).not.toMatch(
		/<script|foreignObject|<image|<animate|onload=|onclick=|javascript:|example\.invalid/
	);
	expect(result.styleTags).toBe(0);
	expect(result.text).toContain('Safe text');
	expect(result.marker).toBe('url(#arrow)');
	expect(result.styledFill).toBe('blue');
});

test('failed renderer chunk exposes retry and recovers after the network returns', async ({
	page
}) => {
	const renderer = await chunk('slices/architecture-inventory/lib/diagram-render.ts');
	let blocked = true;
	await page.route('**' + renderer, (route) => (blocked ? route.abort() : route.continue()));
	await page.goto('/app');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await page.getByRole('listbox', { name: 'Diagram types', exact: true }).press('Home');
	await expect(page.getByRole('button', { name: 'Retry diagram', exact: true })).toBeVisible();
	blocked = false;
	await page.getByRole('button', { name: 'Retry diagram', exact: true }).click();
	await expect(page.locator('.view-canvas svg')).toBeVisible();
	await expect(page.locator('.view-canvas')).toHaveAttribute('aria-busy', 'false');
});

test('Pele import failure falls back and the next preview retries Pele', async ({ page }) => {
	const pele = await chunk('node_modules/pele/dist/pele.js');
	let blocked = true;
	let attempts = 0;
	await page.route('**' + pele, (route) => {
		attempts += 1;
		return blocked ? route.abort() : route.continue();
	});
	await page.goto('/app');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await page.getByRole('listbox', { name: 'Diagram types', exact: true }).press('Home');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-renderer', 'mermaid');
	blocked = false;
	await page.getByRole('listbox', { name: 'Diagram types' }).press('ArrowDown');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-view-kind', 'sequence');
	await expect(page.locator('.view-canvas')).toHaveAttribute('data-renderer', 'pele');
	expect(attempts).toBeGreaterThanOrEqual(2);
});

test('SVG sanitizer fails closed for invalid and excessive output', async ({ page }) => {
	await page.goto('/app');
	const path = await chunk('slices/architecture-inventory/lib/diagram-svg.ts');
	const failures = await page.evaluate(async (path) => {
		const { sanitizeDiagramSvg } = await import(/* @vite-ignore */ path);
		return ['<div>not SVG</div>', '<svg></svg><svg></svg>', 'x'.repeat(2_000_001)].map(
			(payload) => {
				try {
					sanitizeDiagramSvg(payload);
					return false;
				} catch {
					return true;
				}
			}
		);
	}, path);
	expect(failures).toEqual([true, true, true]);
});

test('SVG CSS retains safe rules alongside keyframes and respects cascade priorities', async ({
	page
}) => {
	await page.goto('/app');
	const path = await chunk('slices/architecture-inventory/lib/diagram-svg.ts');
	const result = await page.evaluate(async (path) => {
		const { sanitizeDiagramSvg } = await import(/* @vite-ignore */ path);
		const fragment = sanitizeDiagramSvg(
			`<svg xmlns="http://www.w3.org/2000/svg"><style>@keyframes harmless {from{opacity:0}to{opacity:1}} #n{fill:red}text{fill:blue} .important{fill:orange!important} #later{stroke:red} #later{stroke:green} :is(#choice,.unused){fill:purple} .choice{fill:yellow}</style><text id="n">N</text><text class="important" style="fill:green">Important</text><text id="inline" class="important" style="fill:pink!important">Inline</text><text id="later">Later</text><text id="choice" class="choice">Choice</text></svg>`
		);
		const svg = fragment.firstElementChild!;
		const fill = (selector: string) => (svg.querySelector(selector) as SVGElement).style.fill;
		return {
			id: fill('#n'),
			important: fill('.important'),
			inline: fill('#inline'),
			later: (svg.querySelector('#later') as SVGElement).style.stroke,
			choice: fill('#choice'),
			styleCount: svg.querySelectorAll('style').length
		};
	}, path);
	expect(result).toEqual({
		id: 'red',
		important: 'orange',
		inline: 'pink',
		later: 'green',
		choice: 'purple',
		styleCount: 0
	});
});

test('SVG CSS processing budgets apply across stylesheets', async ({ page }) => {
	await page.goto('/app');
	const path = await chunk('slices/architecture-inventory/lib/diagram-svg.ts');
	const result = await page.evaluate(async (path) => {
		const { sanitizeDiagramSvg } = await import(/* @vite-ignore */ path);
		const cases = [
			`<svg><style>${' '.repeat(60_000)}</style><style>${' '.repeat(60_000)}</style></svg>`,
			`<svg><style>${'text{fill:red}'.repeat(1_100)}</style><style>${'text{fill:blue}'.repeat(1_100)}</style></svg>`,
			`<svg><style>${'text{fill:red}'.repeat(500)}</style>${'<text>X</text>'.repeat(5_000)}</svg>`
		];
		return cases.map((payload) => {
			try {
				sanitizeDiagramSvg(payload);
				return '';
			} catch (error) {
				return String(error);
			}
		});
	}, path);
	expect(result[0]).toContain('total stylesheet budget');
	expect(result[1]).toContain('total CSS rule budget');
	expect(result[2]).toMatch(/style processing budget|selector processing budget/);
});
