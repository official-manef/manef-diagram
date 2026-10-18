import { expect, test } from '@playwright/test';

for (const width of [320, 390]) {
	test(`workspace navigation returns focus after Escape from a link at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/embed/workspace');
		const navigation = page.getByRole('button', {
			name: 'Workspace navigation',
			exact: true,
			includeHidden: true
		});
		await expect(navigation).toBeEnabled();
		for (let attempt = 0; attempt < 2; attempt++) {
			await navigation.click();
			await page
				.locator('#workspace-navigation')
				.getByRole('link', { name: 'Diagram', exact: true })
				.focus();
			await page.keyboard.press('Escape');
			await expect(navigation).toHaveAttribute('aria-expanded', 'false');
			await expect(navigation).toBeFocused();
		}
		await navigation.click();
		await page
			.locator('#workspace-navigation')
			.getByRole('link', { name: 'Diagram', exact: true })
			.click();
		await expect(page).toHaveURL(/\/embed\/workspace\/diagram$/);
		await expect(
			page.getByRole('heading', { name: 'Workspace diagram', exact: true })
		).toBeVisible();
		await expect(navigation).toHaveAttribute('aria-expanded', 'false');
	});
}

for (const width of [320, 1440]) {
	test(`support dismissal retains its draft and restores the opener at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto('/embed/workspace');
		const navigation = page.getByRole('button', {
			name: 'Workspace navigation',
			exact: true,
			includeHidden: true
		});
		await expect(navigation).toBeEnabled();
		if (width < 1024) {
			await navigation.click();
		}
		const support = page.getByRole('button', { name: 'Simulated support', exact: true });
		const panel = page.getByRole('complementary', { name: 'Simulated support', exact: true });
		await support.click();
		const message = panel.getByRole('textbox', { name: 'Message', exact: true });
		await expect(message).toBeFocused();
		await message.fill('Unsent local draft');
		await message.press('Escape');
		await expect(panel).toBeHidden();
		await expect(support).toBeFocused();
		if (width < 1024) await expect(navigation).toHaveAttribute('aria-expanded', 'true');
		await support.press('Enter');
		await expect(message).toHaveValue('Unsent local draft');
		await panel.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(support).toBeFocused();
		await support.press('Enter');
		await expect(message).toHaveValue('Unsent local draft');
		await panel.getByRole('button', { name: 'Close', exact: true }).click();
	});
}

test('support close falls back to the visible navigation trigger after its menu closes', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 844 });
	await page.goto('/embed/workspace');
	const navigation = page.getByRole('button', {
		name: 'Workspace navigation',
		exact: true,
		includeHidden: true
	});
	await expect(navigation).toBeEnabled();
	await navigation.click();
	await page.getByRole('button', { name: 'Simulated support', exact: true }).click();
	await navigation.click();
	await page
		.getByRole('complementary', { name: 'Simulated support', exact: true })
		.getByRole('button', { name: 'Close', exact: true })
		.click();
	await expect(navigation).toBeFocused();
});
