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

test('rejected demo links retain input until a valid link is saved', async ({ page }) => {
	await page.goto('/embed/workspace/diagram');
	const from = page.getByLabel('Link from', { exact: true });
	const to = page.getByLabel('Link to', { exact: true });
	const form = page.locator('form').filter({ has: from });
	const label = form.getByRole('textbox', { name: 'Label', exact: true });
	await expect(from).toBeEnabled();
	const ids = await from
		.locator('option')
		.evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
	await from.selectOption(ids[1]);
	await to.selectOption(ids[1]);
	await label.fill('Keep this draft');
	await form.getByRole('button', { name: 'Add demo link' }).click();
	await expect(
		page.getByText('That demo link was rejected. Use two different nodes and a new direction.', {
			exact: true
		})
	).toBeVisible();
	await expect(from).toHaveValue(ids[1]);
	await expect(to).toHaveValue(ids[1]);
	await expect(label).toHaveValue('Keep this draft');
	// Select a reverse direction absent from the default graph.
	await from.selectOption(ids[ids.length - 1]);
	await to.selectOption(ids[0]);
	await form.getByRole('button', { name: 'Add demo link' }).click();
	await expect(page.getByText('Demo link added.', { exact: true })).toBeVisible();
	await expect(label).toHaveValue('');
	await from.selectOption(ids[ids.length - 1]);
	await to.selectOption(ids[0]);
	await label.fill('Duplicate draft');
	await form.getByRole('button', { name: 'Add demo link' }).click();
	await expect(label).toHaveValue('Duplicate draft');
	await expect(from).toHaveValue(ids[ids.length - 1]);
	await expect(to).toHaveValue(ids[0]);
});

for (const surface of ['context', 'ops']) {
	test(`${surface}: whitespace-only submission retains draft and permits correction`, async ({
		page
	}) => {
		await page.goto(`/embed/workspace/${surface}`);
		const input = page.getByRole('textbox', {
			name: surface === 'context' ? 'Label' : 'Host label',
			exact: true
		});
		await expect(input).toBeEnabled();
		await input.fill('   ');
		if (surface === 'context')
			await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Keep notes');
		await input.press('Enter');
		await expect(input).toHaveValue('   ');
		await expect(
			page.getByText(
				surface === 'context'
					? 'Enter a non-empty context label.'
					: 'Enter a non-empty host label.',
				{ exact: true }
			)
		).toBeVisible();
		if (surface === 'context')
			await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
				'Keep notes'
			);
		await input.fill('Corrected draft');
		await input.press('Enter');
		await expect(input).toHaveValue('');
		await expect(page.getByText('Corrected draft', { exact: true })).toBeVisible();
	});
}
