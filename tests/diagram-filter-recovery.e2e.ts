import { expect, test } from '@playwright/test';

for (const width of [320, 390, 1440]) {
	test(`filter recovers focus and selection across repeated Escape closes at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/app');
		await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
		await page
			.locator(width < 1024 ? '.mobile-card' : '.node-select')
			.first()
			.click();
		const selectedLabel = await page.getByLabel('Label', { exact: true }).inputValue();
		const filter = page.getByRole('button', { name: 'Filter', exact: true });
		const search = page.getByRole('textbox', { name: 'Filter tags', exact: true });

		await filter.click();
		await expect(search).toBeFocused();
		await search.fill('vercel');
		for (let attempt = 0; attempt < 2; attempt++) {
			await search.press('Escape');
			await expect(filter).toHaveAttribute('aria-expanded', 'false');
			await expect(page.getByRole('dialog', { name: 'Tag filters' })).toBeHidden();
			await expect(filter).toBeFocused();
			await expect(page.getByLabel('Label', { exact: true })).toHaveValue(selectedLabel);
			await filter.press('Enter');
			await expect(search).toBeFocused();
			await expect(search).toHaveValue('vercel');
		}
		await page.getByRole('button', { name: 'Name', exact: true }).focus();
		await page.keyboard.press('Escape');
		await expect(filter).toHaveAttribute('aria-expanded', 'false');
		await expect(filter).toBeFocused();
		await expect(page.getByLabel('Label', { exact: true })).toHaveValue(selectedLabel);
	});
}

test('desktop filter backdrop closes to its trigger and stays outside the tab sequence', async ({
	page
}) => {
	await page.setViewportSize({ width: 1440, height: 844 });
	await page.goto('/app');
	await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
	await page.locator('.node-select').first().click();
	const selectedLabel = await page.getByLabel('Label', { exact: true }).inputValue();
	const filter = page.getByRole('button', { name: 'Filter', exact: true });
	await filter.click();
	await expect(page.getByRole('textbox', { name: 'Filter tags' })).toBeFocused();
	const backdrop = page.getByRole('button', { name: 'Close filters', exact: true });
	await expect(backdrop).toHaveAttribute('tabindex', '-1');
	await backdrop.click({ position: { x: 800, y: 500 } });
	await expect(filter).toHaveAttribute('aria-expanded', 'false');
	await expect(filter).toBeFocused();
	await expect(page.getByLabel('Label', { exact: true })).toHaveValue(selectedLabel);
});

for (const width of [320, 390]) {
	test(`phone List and Canvas leave an open view while preserving its source at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/app');
		await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
		await page.locator('.mobile-card').first().click();
		await page.getByRole('button', { name: 'Canvas', exact: true }).click();
		await page.getByLabel('Add view', { exact: true }).selectOption({ label: 'Flowchart' });
		await expect(page.locator('.view-canvas svg')).toBeVisible();
		const source = await page
			.getByRole('textbox', { name: 'Diagram source', exact: true })
			.inputValue();
		const view = page.locator('.view-list button').first();
		for (const mode of ['List', 'Canvas']) {
			await page.getByRole('button', { name: mode, exact: true }).click();
			await expect(page.getByRole('button', { name: mode, exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(page.locator('.mermaid-view')).toBeHidden();
			await expect(page.locator(mode === 'List' ? '.mobile-map' : '.world')).toBeVisible();
			await expect(page.getByLabel('Label', { exact: true })).toHaveValue('MANEF');
			await view.click();
			await expect(page.locator('.view-canvas svg')).toBeVisible();
			await expect(page.getByRole('textbox', { name: 'Diagram source', exact: true })).toHaveValue(
				source
			);
		}
	});
}
