import { expect, test } from '@playwright/test';

test('native dropdowns support keyboard selection and keep accessible labels', async ({ page }) => {
	await page.goto('/app');
	const theme = page.getByLabel('Color theme', { exact: true });
	await theme.focus();
	await theme.press('Home');
	await expect(theme).toHaveValue('composio-dark');
	await theme.press('End');
	await expect(theme).toHaveValue('system');
	const exportFormat = page.getByLabel('Export format', { exact: true });
	await exportFormat.focus();
	await exportFormat.press('End');
	await expect(exportFormat).toHaveValue('n8n-inactive');
	await exportFormat.press('Home');
	await expect(exportFormat).toHaveValue('json');
	await page.getByRole('tab', { name: 'Inventory', exact: true }).click();
	const inventory = page.getByLabel('Inventory type', { exact: true });
	await inventory.focus();
	await inventory.press('End');
	await expect(inventory).toHaveValue('convex');
	await inventory.press('Home');
	await expect(inventory).toHaveValue('all');
	await page.getByRole('tab', { name: 'JSON', exact: true }).click();
	const inputFormat = page.getByLabel('Input format', { exact: true });
	await inputFormat.focus();
	await inputFormat.press('End');
	await expect(inputFormat).toHaveValue('md');
	await inputFormat.press('Home');
	await expect(inputFormat).toHaveValue('json');
});

test('theme and export dropdowns fit small screens with touch targets', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 600 });
	await page.goto('/app');
	for (const label of ['Color theme', 'Export format']) {
		const select = page.getByLabel(label, { exact: true });
		const rect = await select.boundingBox();
		expect(rect).not.toBeNull();
		expect(rect!.height).toBeGreaterThanOrEqual(44);
		expect(rect!.x).toBeGreaterThanOrEqual(0);
		expect(rect!.x + rect!.width).toBeLessThanOrEqual(321);
	}
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('a single click on another control dismisses the picker and performs the action', async ({
	page
}) => {
	await page.goto('/app');
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Diagram types' })).toBeVisible();
	await page.getByRole('button', { name: '+ Node', exact: true }).click();
	await expect(page.getByRole('listbox', { name: 'Diagram types' })).toBeHidden();
	await expect(page.getByRole('textbox', { name: 'Label', exact: true })).toHaveValue('New node');
});
