import { expect, test } from '@playwright/test';
import { workspaceUrl } from '../src/lib/config/navigation';

test('all workspace addresses redirect to their MANEF owner and retain query state', async ({
	page,
	request
}) => {
	await page.goto('/embed/workspace');
	const paths = await page
		.locator('#workspace-navigation a')
		.evaluateAll((links) =>
			links
				.map((link) => new URL((link as HTMLAnchorElement).href).pathname)
				.filter((path) => path.startsWith('/embed/workspace'))
		);
	expect(paths).toHaveLength(11);
	for (const path of paths) {
		const suffix = path.slice('/embed/workspace'.length);
		const response = await request.get('/workspace' + suffix + '?preview=1', { maxRedirects: 0 });
		expect(response.status()).toBe(308);
		expect(response.headers().location).toBe(workspaceUrl(suffix.slice(1)) + '?preview=1');
	}
	expect((await request.get('/workspace/unknown', { maxRedirects: 0 })).status()).toBe(404);
	expect((await request.get('/embed/workspace/unknown')).status()).toBe(404);
});
