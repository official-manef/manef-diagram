import { describe, expect, it } from 'vitest';
import { createDemoState, installApp } from './logic';
import { restoreWorkspaceSnapshot } from './storage';

function snapshot() {
	return {
		active: 'Product studio',
		theme: 'dark',
		workspaces: {
			'Product studio': installApp(createDemoState('Product studio'), 'hermes'),
			Sandbox: createDemoState('Sandbox')
		}
	};
}

describe('demo workspace storage recovery', () => {
	it('restores complete isolated workspaces without moving theme ownership', () => {
		const saved = snapshot();
		const restored = restoreWorkspaceSnapshot(JSON.parse(JSON.stringify(saved)));
		expect(restored?.active).toBe('Product studio');
		expect(restored?.workspaces['Product studio'].apps).toEqual(['hermes']);
		expect(restored?.workspaces.Sandbox.apps).toEqual([]);
		expect(restored).not.toHaveProperty('theme');
	});

	it.each([
		null,
		[],
		{},
		{ active: 'Product studio', workspaces: { 'Product studio': {} } },
		{ active: 'constructor', workspaces: {} },
		{ active: 'Sandbox', workspaces: { 'Product studio': createDemoState() } }
	])('rejects missing or inherited active workspace data: %j', (value) => {
		expect(restoreWorkspaceSnapshot(value)).toBeNull();
	});

	it.each([
		{ schemaVersion: 2 },
		{ workspace: 'Another workspace' },
		{ profile: { signedIn: 'yes', role: 'owner', name: 'Builder' } },
		{ apps: {} },
		{ connections: { github: 'yes' } },
		{ routing: { primary: 'Demo' } },
		{ activities: [{ id: 'a', text: 'Missing fields' }] },
		{
			runs: [
				{ id: 'same', text: 'First' },
				{ id: 'same', text: 'Second' }
			]
		},
		{ domains: [{ id: 'domain', host: 'example.test' }] },
		{ reviews: [42] },
		{ graph: { nodes: [], edges: [{ id: 'dangling', source: 'a', target: 'b', label: 'joins' }] } }
	])('rejects inconsistent state before any screen reads it: %j', (patch) => {
		const saved = snapshot();
		const value = {
			...saved,
			workspaces: {
				...saved.workspaces,
				'Product studio': { ...saved.workspaces['Product studio'], ...patch }
			}
		};
		expect(restoreWorkspaceSnapshot(value)).toBeNull();
	});

	it('rejects malformed graph nodes and duplicate graph IDs', () => {
		const saved = snapshot();
		const state = saved.workspaces['Product studio'];
		state.graph.nodes[0].x = Number.NaN;
		expect(restoreWorkspaceSnapshot(saved)).toBeNull();
		state.graph.nodes[0].x = 40;
		state.graph.nodes.push({ ...state.graph.nodes[0] });
		expect(restoreWorkspaceSnapshot(saved)).toBeNull();
		state.graph.nodes.pop();
		state.graph.edges.push({ ...state.graph.edges[0] });
		expect(restoreWorkspaceSnapshot(saved)).toBeNull();
	});

	it('also validates an inactive workspace before restoring it', () => {
		const saved = snapshot();
		const value = { ...saved, workspaces: { ...saved.workspaces, Sandbox: {} } };
		expect(restoreWorkspaceSnapshot(value)).toBeNull();
	});

	it('allows legitimate empty imported graphs and older snapshots without review flags', () => {
		const saved = snapshot();
		saved.workspaces.Sandbox.graph = { nodes: [], edges: [] };
		delete saved.workspaces.Sandbox.reviews;
		expect(restoreWorkspaceSnapshot(saved)?.workspaces.Sandbox.graph.nodes).toEqual([]);
	});
});
