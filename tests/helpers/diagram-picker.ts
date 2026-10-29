import { expect, type Page } from '@playwright/test';

/** Explicitly attach the preview; arrow navigation itself must never create views. */
export async function addDiagramView(page: Page, label: string) {
	await page.getByRole('button', { name: 'Diagram type', exact: true }).click();
	await page.getByRole('option', { name: label, exact: true }).click();
	await page.getByRole('listbox', { name: 'Diagram types', exact: true }).press('Escape');
	await page.getByRole('button', { name: 'Add to selected node', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toBeFocused();
}
