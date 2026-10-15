import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	// Local origins are deliberately excluded from the production installation.
	// Exercise the real launcher with a configuration fixture and no conversation writes.
	await page.route(
		'https://airin-staging-1110-oraahc-dd614a-43-156-62-134.sslip.io/api/public/widgets/*',
		(route) =>
			route.fulfill({
				json: { name: 'diagram', greeting: 'Halo! Ada yang bisa kami bantu?' },
				headers: { 'access-control-allow-origin': '*' }
			})
	);
	await page.addInitScript(() => {
		document.addEventListener('DOMContentLoaded', () => {
			const script = document.createElement('script');
			script.src = 'https://airin-staging-1110-oraahc-dd614a-43-156-62-134.sslip.io/widget.js';
			script.dataset.airinWidget = 'f8674b7b-d053-4650-8266-a8e88afd2c07';
			script.defer = true;
			document.head.append(script);
		});
	});
});

test('Airin opens, closes and survives client navigation without duplicate launchers', async ({
	page
}) => {
	await page.goto('/');
	const launcher = page.getByRole('button', { name: 'Chat with us', exact: true });
	await launcher.click();
	await expect(page.getByRole('dialog', { name: 'Website support chat' })).toBeVisible();
	await expect(page.getByRole('log', { name: 'Conversation' })).toContainText(
		'Halo! Ada yang bisa kami bantu?'
	);
	await page.getByLabel('Your message', { exact: true }).press('Escape');
	await expect(launcher).toBeFocused();
	await page.getByRole('link', { name: 'Read the guide', exact: true }).click();
	await expect(page).toHaveURL(/\/guide$/);
	await expect(launcher).toHaveCount(1);
	await launcher.click();
	await expect(page.getByRole('dialog', { name: 'Website support chat' })).toBeVisible();
});

test('Airin leaves the phone dock and diagram editing controls clickable', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/apps/dashboard');
	const launcher = page.getByRole('button', { name: 'Chat with us', exact: true });
	await expect(launcher).toBeVisible();
	const dock = page.getByRole('navigation', { name: 'Mobile app dock' });
	const launcherBox = await launcher.boundingBox();
	const dockBox = await dock.boundingBox();
	expect(launcherBox!.y + launcherBox!.height).toBeLessThanOrEqual(dockBox!.y);
	await dock.getByRole('link', { name: 'Assistant', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Assistant', exact: true })).toBeVisible();
	await page.goto('/app');
	await expect(launcher).toBeVisible();
	await page.getByRole('button', { name: 'mso.manef.dev Manef Shell OS', exact: true }).click();
	await page.getByRole('link', { name: 'Edit mso.manef.dev', exact: true }).click();
	const output = page.getByRole('button', { name: 'Use output', exact: true });
	// A phone user can scroll the final controls above the floating launcher.
	await page.mouse.wheel(0, 720);
	await expect
		.poll(async () => {
			const target = await output.boundingBox();
			const chat = await launcher.boundingBox();
			return target!.y + target!.height <= chat!.y;
		})
		.toBe(true);
	await output.click();
	await expect(output).toHaveAttribute('aria-pressed', 'true');
});
