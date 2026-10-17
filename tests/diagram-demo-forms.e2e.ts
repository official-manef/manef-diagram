import { expect, test } from '@playwright/test';

for (const surface of ['models', 'ops']) {
	test(`${surface}: local demo forms wait for hydration before accepting input`, async ({
		page
	}) => {
		let release!: () => void;
		const ready = new Promise<void>((resolve) => (release = resolve));
		await page.route('**/_app/immutable/**/*.js', async (route) => {
			await ready;
			await route.continue();
		});
		try {
			await page.goto(`/embed/workspace/${surface}`, { waitUntil: 'commit' });
			const form = page.locator('form').first();
			await expect(form.locator('input').first()).toBeDisabled();
			await expect(form.locator('button[type="submit"]')).toBeDisabled();
			release();
			await expect(form.locator('input').first()).toBeEnabled();
			await expect(form.locator('button[type="submit"]')).toBeEnabled();
		} finally {
			release();
		}
	});
}

test('model routing saves a browser-local policy and restores it after reload', async ({
	page
}) => {
	await page.goto('/embed/workspace/models');
	const primary = page.getByRole('textbox', { name: 'Primary', exact: true });
	await expect(primary).toBeEnabled();
	await primary.fill('QA primary');
	await page.getByRole('textbox', { name: 'Fallback', exact: true }).fill('QA fallback');
	await page.getByRole('button', { name: 'Save in this browser', exact: true }).click();
	await expect(page.getByText('Routing saved in this browser.', { exact: true })).toBeVisible();
	await page.reload();
	await expect(primary).toHaveValue('QA primary');
	await expect(page.getByRole('textbox', { name: 'Fallback', exact: true })).toHaveValue(
		'QA fallback'
	);
});

test('operations accepts Enter to save a local plan and restores it after reload', async ({
	page
}) => {
	await page.goto('/embed/workspace/ops');
	const host = page.getByRole('textbox', { name: 'Host label', exact: true });
	await expect(host).toBeEnabled();
	await host.fill('catalog-qa.example.test');
	await host.press('Enter');
	await expect(
		page.getByText('Plan saved locally. No domain was provisioned.', { exact: true })
	).toBeVisible();
	await expect(page.getByText('catalog-qa.example.test', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText('catalog-qa.example.test', { exact: true })).toBeVisible();
});
