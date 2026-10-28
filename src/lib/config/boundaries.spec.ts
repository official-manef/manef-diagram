import { Linter } from 'eslint';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { sliceBoundary } from '../../../scripts/eslint-boundaries.mjs';

test('slice boundaries allow barrels and same-slice code but reject alternate deep imports', () => {
	const lint = (source: string, filename: string) =>
		new Linter().verify(
			source,
			{
				plugins: { starter: { rules: { boundary: sliceBoundary } } },
				rules: { 'starter/boundary': 'error' }
			},
			{ filename: resolve(filename) }
		);
	for (const source of [
		"import x from '$features/dashboard/components/private';",
		"export {x} from '../dashboard/components/private';",
		"import('../dashboard/components/private');"
	]) {
		expect(
			lint(source, 'slices/settings/check.js').some((item) => item.ruleId === 'starter/boundary')
		).toBe(true);
	}
	expect(lint("import x from '$features/dashboard';", 'slices/settings/check.js')).toEqual([]);
	expect(lint("import x from './components/private';", 'slices/settings/check.js')).toEqual([]);
	expect(
		lint("import x from '../../slices/dashboard/components/private';", 'src/routes/check.js').some(
			(item) => item.ruleId === 'starter/boundary'
		)
	).toBe(true);
});

test('the architecture core is a public barrel, not permission for arbitrary deep imports', () => {
	const lint = (source: string) =>
		new Linter().verify(
			source,
			{
				plugins: { starter: { rules: { boundary: sliceBoundary } } },
				rules: { 'starter/boundary': 'error' }
			},
			{ filename: resolve('tests/fixtures/core/consumer.js') }
		);
	for (const source of [
		"import {defaultGraph} from '../../../slices/architecture-inventory/core';",
		"export * from '$features/architecture-inventory/core.ts';"
	])
		expect(lint(source)).toEqual([]);
	for (const source of [
		"import x from '$features/architecture-inventory/lib/document';",
		"import x from '$features/dashboard/core';"
	])
		expect(lint(source).some((item) => item.ruleId === 'starter/boundary')).toBe(true);
});
