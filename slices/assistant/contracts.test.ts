import { expect, it } from 'vitest';
import { isAssistantSettings, isToolListings } from './contracts';

const settings = {
	ai: { enabled: true, providers: [{ id: 'openai', label: 'OpenAI', models: ['approved-model'] }] },
	mcp: { enabled: true, servers: [{ alias: 'approved-service' }] }
};

it('accepts enabled settings and credential-free disabled settings', () => {
	expect(isAssistantSettings(settings)).toBe(true);
	expect(
		isAssistantSettings({
			ai: { enabled: false, providers: [] },
			mcp: { enabled: false, servers: [] }
		})
	).toBe(true);
});

it('rejects invalid setup before lists reach the reactive UI', () => {
	for (const value of [
		null,
		[],
		{},
		{ ai: {} },
		{ ...settings, ai: { enabled: true, providers: null } },
		{
			...settings,
			ai: { enabled: true, providers: [{ id: 'unknown', label: 'Unknown', models: ['model'] }] }
		},
		{
			...settings,
			ai: { ...settings.ai, providers: [...settings.ai.providers, ...settings.ai.providers] }
		},
		{
			...settings,
			ai: { enabled: true, providers: [{ id: 'openai', label: 'OpenAI', models: [null] }] }
		},
		{ ...settings, mcp: { enabled: true, servers: [{ alias: 'one' }, { alias: 'one' }] } },
		{ ...settings, mcp: { enabled: true, servers: [null] } }
	])
		expect(isAssistantSettings(value)).toBe(false);
});

it('accepts empty discovery and uniquely named tools with object schemas', () => {
	expect(isToolListings([])).toBe(true);
	expect(
		isToolListings([
			{ name: 'safe', inputSchema: {} },
			{ name: 'other', description: 'Text', inputSchema: { type: 'object' } }
		])
	).toBe(true);
});

it('rejects malformed or ambiguous tool discovery before keyed rendering or review', () => {
	for (const value of [
		null,
		{},
		[null],
		[{ name: 'bad', inputSchema: [] }],
		[{ name: '', inputSchema: {} }],
		[{ name: 'bad', description: {}, inputSchema: {} }],
		[
			{ name: 'same', inputSchema: {} },
			{ name: 'same', inputSchema: {} }
		]
	])
		expect(isToolListings(value)).toBe(false);
});
