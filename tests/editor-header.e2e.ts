import { expect, test } from '@playwright/test';

for (const metrics of ['native', 'wider intrinsic controls']) {
	test(`editor header controls never overlap across desktop widths: ${metrics}`, async ({
		page
	}) => {
		await page.setViewportSize({ width: 1025, height: 900 });
		await page.goto('/app');
		await expect(page.getByRole('button', { name: 'Graph', exact: true })).toBeEnabled();
		if (metrics !== 'native') {
			// Model legitimate platform/font intrinsic-width differences without depending on host fonts.
			await page.addStyleTag({ content: '.workspace .top-end select { min-width: 140px; }' });
		}
		for (const width of [1025, 1100, 1280, 1440]) {
			await page.setViewportSize({ width, height: 900 });
			await expect
				.poll(
					() =>
						page.locator('.topbar').evaluate((header) => {
							const viewport = document.documentElement.clientWidth;
							return [...header.querySelectorAll<HTMLElement>('button, select, a')].flatMap(
								(control) => {
									if (!control.getClientRects().length || control.hasAttribute('disabled'))
										return [];
									const rect = control.getBoundingClientRect();
									const name = control.getAttribute('aria-label') ?? control.textContent?.trim();
									if (rect.width < 24 || rect.height < 24 || rect.x < 0 || rect.right > viewport)
										return [`${name}: clipped or undersized`];
									for (const x of [rect.x + 4, rect.x + rect.width / 2, rect.right - 4]) {
										for (const y of [
											rect.y + rect.height / 2 - 8,
											rect.y + rect.height / 2,
											rect.y + rect.height / 2 + 8
										]) {
											const hit = document.elementFromPoint(x, y);
											if (!hit || (hit !== control && !control.contains(hit)))
												return [
													`${name}: obscured by ${hit?.getAttribute('aria-label') ?? hit?.tagName}`
												];
										}
									}
									return [];
								}
							);
						}),
					`${width}px header hit testing`
				)
				.toEqual([]);
		}
	});
}
