import { expect, test, type Page } from '@playwright/test';

const settings = {
	ai: { enabled: true, providers: [{ id: 'openai', label: 'OpenAI', models: ['fixture-model'] }] },
	mcp: { enabled: true, servers: [{ alias: 'fixture-service' }] }
};
const providerKey = 'fixture-provider-key';
const serverKey = 'fixture-server-key';

async function captureQa(page: Page, name: string) {
	if (process.env.QA_SCREENSHOT_DIR)
		await page.screenshot({
			path: `${process.env.QA_SCREENSHOT_DIR}/${name}-${test.info().project.name}.png`,
			fullPage: true
		});
}

async function openAssistant(page: Page) {
	await page.route('**/api/ai/config', (route) => route.fulfill({ json: settings }));
	await page.goto('/apps/assistant');
	await expect(page.getByLabel('Your provider API key', { exact: true })).toBeEnabled();
}

test('enabled assistant sends BYOK chat, displays streamed text and clears sensitive page state', async ({
	page
}) => {
	const submitted: unknown[] = [];
	await page.route('**/api/ai/chat', async (route) => {
		submitted.push(route.request().postDataJSON());
		await route.fulfill({
			contentType: 'application/x-ndjson',
			body:
				[
					{ type: 'text', text: 'A streamed ' },
					{ type: 'text', text: 'fixture reply.' },
					{ type: 'done' }
				]
					.map((event) => JSON.stringify(event))
					.join('\n') + '\n'
		});
	});
	await openAssistant(page);
	await page.getByLabel('Your provider API key', { exact: true }).fill(providerKey);
	await page.getByLabel('Message', { exact: true }).fill('A fixture question');
	await page.getByRole('button', { name: 'Send message', exact: true }).click();
	await expect(page.getByText('A streamed fixture reply.', { exact: true })).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Response complete');
	expect(submitted).toEqual([
		{
			provider: 'openai',
			model: 'fixture-model',
			apiKey: providerKey,
			messages: [{ role: 'user', content: 'A fixture question' }]
		}
	]);
	const storage = await page.evaluate(() =>
		JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])
	);
	expect(storage).not.toContain(providerKey);
	expect(storage).not.toContain('A fixture question');
	await page.getByRole('button', { name: 'Clear keys and conversation' }).click();
	await expect(page.getByLabel('Your provider API key', { exact: true })).toHaveValue('');
	await expect(page.getByRole('list', { name: 'Conversation' })).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test('generation can be stopped while awaiting the provider', async ({ page }) => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/api/ai/chat', async (route) => {
		await gate;
		await route
			.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"done"}\n' })
			.catch(() => undefined);
	});
	try {
		await openAssistant(page);
		await page.getByLabel('Your provider API key', { exact: true }).fill(providerKey);
		await page.getByLabel('Message', { exact: true }).fill('Stop this fixture');
		await page.getByRole('button', { name: 'Send message', exact: true }).click();
		await page.getByRole('button', { name: 'Stop generation', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Generation stopped');
		await expect(page.getByRole('button', { name: 'Stop generation', exact: true })).toHaveCount(0);
		await expect(page.getByText('Waiting for response…', { exact: true })).toHaveCount(0);
	} finally {
		release();
		await page.unrouteAll({ behavior: 'wait' });
	}
});

test('MCP discovery and review never execute a tool until the exact call is confirmed', async ({
	page
}) => {
	const executions: unknown[] = [];
	await page.route('**/api/mcp/tools', async (route) => {
		const input = route.request().postDataJSON();
		if (input.action === 'list') {
			await route.fulfill({
				json: [
					{
						name: 'fixture_tool',
						description: 'Untrusted service description',
						inputSchema: { type: 'object', properties: { text: { type: 'string' } } }
					}
				]
			});
		} else {
			executions.push(input);
			await route.fulfill({ json: { content: [{ type: 'text', text: 'Fixture tool result' }] } });
		}
	});
	await openAssistant(page);
	await page.getByLabel('Your server token or API key', { exact: true }).fill(serverKey);
	await page.getByRole('button', { name: 'Discover tools', exact: true }).click();
	await expect(page.getByLabel('Allowed tool', { exact: true })).toHaveValue('fixture_tool');
	expect(executions).toHaveLength(0);
	const argumentsInput = page.getByLabel('Arguments (JSON object)', { exact: true });
	await argumentsInput.fill('{"text":"Approved fixture"}');
	await page.getByRole('button', { name: 'Review tool call', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Confirm tool call' })).toContainText(
		'Approved fixture'
	);
	await expect(argumentsInput).toBeDisabled();
	expect(executions).toHaveLength(0);
	await page.getByRole('button', { name: 'Cancel review', exact: true }).click();
	await expect(argumentsInput).toBeEnabled();
	expect(executions).toHaveLength(0);
	await page.getByRole('button', { name: 'Review tool call', exact: true }).click();
	await page.getByRole('button', { name: 'Confirm and execute once', exact: true }).click();
	await expect(page.getByText('Fixture tool result', { exact: false })).toBeVisible();
	expect(executions).toEqual([
		{
			action: 'execute',
			alias: 'fixture-service',
			tool: 'fixture_tool',
			arguments: { text: 'Approved fixture' },
			token: serverKey,
			confirmed: true
		}
	]);
	await expect(page.getByRole('region', { name: 'Confirm tool call' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Clear keys and conversation' }).click();
	await expect(page.getByLabel('Your server token or API key', { exact: true })).toHaveValue('');
	await expect(page.getByText('Fixture tool result', { exact: false })).toHaveCount(0);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
});

test('switching MCP servers clears credentials and arguments from the previous server', async ({
	page
}) => {
	await page.route('**/api/ai/config', (route) =>
		route.fulfill({
			json: {
				...settings,
				mcp: { enabled: true, servers: [{ alias: 'fixture-service' }, { alias: 'other-service' }] }
			}
		})
	);
	await page.route('**/api/mcp/tools', (route) =>
		route.fulfill({ json: [{ name: 'fixture_tool', inputSchema: { type: 'object' } }] })
	);
	await page.goto('/apps/assistant');
	const key = page.getByLabel('Your server token or API key', { exact: true });
	await key.fill(serverKey);
	await page.getByRole('button', { name: 'Discover tools', exact: true }).click();
	await page
		.getByLabel('Arguments (JSON object)', { exact: true })
		.fill('{"text":"Previous server context"}');
	await page.getByLabel('Configured server', { exact: true }).selectOption('other-service');
	await expect(key).toHaveValue('');
	await expect(page.getByRole('button', { name: 'Discover tools', exact: true })).toBeDisabled();
	await captureQa(page, 'mcp-context-after');
	await key.fill('fixture-other-server-key');
	await page.getByRole('button', { name: 'Discover tools', exact: true }).click();
	await expect(page.getByLabel('Arguments (JSON object)', { exact: true })).toHaveValue('{}');
});

test('setup refresh keeps approved selections and clears keys when their contexts are removed', async ({
	page
}) => {
	const expanded = {
		ai: {
			enabled: true,
			providers: [
				{ id: 'openai', label: 'OpenAI', models: ['fixture-model'] },
				{ id: 'anthropic', label: 'Anthropic', models: ['first-model', 'second-model'] }
			]
		},
		mcp: { enabled: true, servers: [{ alias: 'fixture-service' }, { alias: 'other-service' }] }
	};
	let current = expanded;
	await page.route('**/api/ai/config', (route) => route.fulfill({ json: current }));
	await page.goto('/apps/assistant');
	const provider = page.getByLabel('Provider', { exact: true });
	await expect(provider).toBeEnabled();
	await provider.selectOption('anthropic');
	await page.getByLabel('Approved model', { exact: true }).selectOption('second-model');
	await page.getByLabel('Your provider API key', { exact: true }).fill('fixture-anthropic-key');
	await page.getByLabel('Configured server', { exact: true }).selectOption('other-service');
	await page
		.getByLabel('Your server token or API key', { exact: true })
		.fill('fixture-other-server-key');
	await page.getByRole('button', { name: 'Check setup', exact: true }).click();
	await expect(provider).toBeEnabled();
	await expect(provider).toHaveValue('anthropic');
	await expect(page.getByLabel('Approved model', { exact: true })).toHaveValue('second-model');
	await expect(page.getByLabel('Your provider API key', { exact: true })).toHaveValue(
		'fixture-anthropic-key'
	);
	await expect(page.getByLabel('Configured server', { exact: true })).toHaveValue('other-service');
	await expect(page.getByLabel('Your server token or API key', { exact: true })).toHaveValue(
		'fixture-other-server-key'
	);
	current = { ...expanded, ai: settings.ai, mcp: settings.mcp };
	await page.getByRole('button', { name: 'Check setup', exact: true }).click();
	await expect(provider).toHaveValue('openai');
	await expect(page.getByLabel('Your provider API key', { exact: true })).toHaveValue('');
	await expect(page.getByLabel('Configured server', { exact: true })).toHaveValue(
		'fixture-service'
	);
	await expect(page.getByLabel('Your server token or API key', { exact: true })).toHaveValue('');
	await captureQa(page, 'provider-refresh-after');
});

test('malformed setup leaves a recoverable error and can be retried without exposing its payload', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	let valid = false;
	await page.route('**/api/ai/config', (route) =>
		route.fulfill({
			json: valid
				? settings
				: { ai: { enabled: true, providers: null }, privateCanary: 'fixture-private-payload' }
		})
	);
	await page.goto('/apps/assistant');
	await expect(page.getByRole('alert')).toContainText('Setup response is invalid');
	await expect(page.locator('body')).not.toContainText('fixture-private-payload');
	await captureQa(page, 'assistant-setup-after');
	valid = true;
	await page.getByRole('button', { name: 'Check setup', exact: true }).click();
	await expect(page.getByLabel('Your provider API key', { exact: true })).toBeEnabled();
	await expect(page.getByRole('alert')).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('clearing an in-flight generation keeps the cleared page free of stale errors', async ({
	page
}) => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/api/ai/chat', async (route) => {
		await gate;
		await route
			.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"done"}\n' })
			.catch(() => undefined);
	});
	try {
		await openAssistant(page);
		await page.getByLabel('Your provider API key', { exact: true }).fill(providerKey);
		await page.getByLabel('Message', { exact: true }).fill('Clear this pending fixture');
		await page.getByRole('button', { name: 'Send message', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Stop generation', exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Clear keys and conversation', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Check setup', exact: true })).toBeEnabled();
		await expect(page.getByRole('alert')).toHaveCount(0);
		await expect(page.getByRole('list', { name: 'Conversation' })).toHaveCount(0);
		await expect(page.getByLabel('Your provider API key', { exact: true })).toHaveValue('');
		await captureQa(page, 'assistant-clear-after');
	} finally {
		release();
		await page.unrouteAll({ behavior: 'wait' });
	}
});

test('invalid tool discovery is recoverable and does not crash keyed rendering', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	const tool = { name: 'fixture_tool', inputSchema: { type: 'object' } };
	let valid = false;
	await page.route('**/api/mcp/tools', (route) =>
		route.fulfill({ json: valid ? [tool] : [tool, tool] })
	);
	await openAssistant(page);
	await page.getByLabel('Your server token or API key', { exact: true }).fill(serverKey);
	await page.getByRole('button', { name: 'Discover tools', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Tool discovery response is invalid');
	await expect(page.getByLabel('Allowed tool', { exact: true })).toHaveCount(0);
	valid = true;
	await page.getByRole('button', { name: 'Discover tools', exact: true }).click();
	await expect(page.getByLabel('Allowed tool', { exact: true })).toHaveValue('fixture_tool');
	await expect(page.getByRole('alert')).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('an incomplete model stream retains partial text without reporting success', async ({
	page
}) => {
	await page.route('**/api/ai/chat', (route) =>
		route.fulfill({
			contentType: 'application/x-ndjson',
			body: '{"type":"text","text":"Partial fixture response"}\n'
		})
	);
	await openAssistant(page);
	await page.getByLabel('Your provider API key', { exact: true }).fill(providerKey);
	await page.getByLabel('Message', { exact: true }).fill('Incomplete fixture');
	await page.getByRole('button', { name: 'Send message', exact: true }).click();
	await expect(page.getByText('Partial fixture response', { exact: true })).toBeVisible();
	await expect(page.getByRole('alert')).toContainText('The response ended early');
	await expect(page.getByRole('status')).not.toHaveText('Response complete');
});
