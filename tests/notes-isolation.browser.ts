import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.route('**/auth/token', async (route) => {
		const body = route.request().postDataJSON() as { expectedTokenIdentifier: string };
		await route.fulfill({ json: { idToken: body.expectedTokenIdentifier.split('|').at(-1) } });
	});
	await page.goto('/');
	await expect(page.getByText('Alice private note', { exact: true })).toBeVisible();
});

test('account handoff hides the former cache and draft until the new backend auth is confirmed', async ({
	page
}, testInfo) => {
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByLabel('Note', { exact: true }).fill('Alice unsaved draft');
	let release!: () => void;
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/auth/token', async (route) => {
		const body = route.request().postDataJSON() as { expectedTokenIdentifier: string };
		await held;
		await route.fulfill({ json: { idToken: body.expectedTokenIdentifier.split('|').at(-1) } });
	});
	try {
		await page.getByRole('button', { name: 'Use Bob', exact: true }).click();
		await expect(page.getByText('Checking your sign-in…')).toBeVisible();
		await expect(page.getByText('Alice private note', { exact: true })).toHaveCount(0);
		await expect(page.getByLabel('Note', { exact: true })).toHaveCount(0);
		await expect(page.getByLabel('Clients closed')).toHaveText('1');
		await page.screenshot({
			path: testInfo.outputPath('account-handoff-pending.png'),
			fullPage: true
		});
		release();
		await expect(page.getByText('Bob private note', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Note', { exact: true })).toHaveValue('');
		await expect(page.getByText('New note', { exact: true })).toBeVisible();
		await page.screenshot({
			path: testInfo.outputPath('new-account-confirmed.png'),
			fullPage: true
		});
	} finally {
		release();
	}
});

test('auth loss destroys drafts and edit state before authentication resumes', async ({ page }) => {
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByLabel('Note', { exact: true }).fill('Private unsaved draft');
	await page.getByRole('button', { name: 'Reject auth', exact: true }).click();
	await expect(page.getByRole('link', { name: 'Sign in again', exact: true })).toBeVisible();
	await expect(page.getByText('Alice private note', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Note', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Confirm auth', exact: true }).click();
	await expect(page.getByLabel('Note', { exact: true })).toHaveValue('');
	await expect(page.getByText('New note', { exact: true })).toBeVisible();
});

test('a former owner mutation completion cannot clear the new owner draft or announce success', async ({
	page
}) => {
	await page.getByLabel('Note', { exact: true }).fill('Alice queued draft');
	await page.getByRole('button', { name: 'Hold mutation', exact: true }).click();
	await page.getByRole('button', { name: 'Save note', exact: true }).click();
	await expect(page.getByLabel('Note', { exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Use Bob', exact: true }).click();
	await expect(page.getByText('Bob private note', { exact: true })).toBeVisible();
	await page.getByLabel('Note', { exact: true }).fill('Bob current draft');
	await page.getByRole('button', { name: 'Finish mutation', exact: true }).click();
	await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Bob current draft');
	await expect(page.getByText('Note saved.', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Alice queued draft', { exact: true })).toHaveCount(0);
});

test('query and mutation errors are safe and a failed save preserves recoverable input', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Fail query', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Your notes could not be loaded.');
	await expect(page.getByText('Alice private note', { exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Recover query', exact: true }).click();
	await expect(page.getByText('Alice private note', { exact: true })).toBeVisible();
	await page.getByLabel('Note', { exact: true }).fill('Retry this draft');
	await page.getByRole('button', { name: 'Hold mutation', exact: true }).click();
	await page.getByRole('button', { name: 'Save note', exact: true }).click();
	await expect(page.getByLabel('Note', { exact: true })).toBeDisabled();
	await page.getByRole('button', { name: 'Fail mutation', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('The note could not be changed.');
	await expect(page.getByLabel('Note', { exact: true })).toHaveValue('Retry this draft');
	await expect(page.getByLabel('Note', { exact: true })).toBeEnabled();
	await expect(page.getByText('private provider payload', { exact: false })).toHaveCount(0);
	await page.getByRole('button', { name: 'Save note', exact: true }).click();
	await expect(page.getByText('Retry this draft', { exact: true })).toBeVisible();
});
