import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema, { architectureGraph } from '../../../convex/schema';
import { api } from '../../../convex/_generated/api';
import { validateGraph } from '$features/architecture-inventory';

const modules = import.meta.glob('../../../convex/**/*.*s');
const identity = (subject: string) => ({
	issuer: 'https://api.workos.com/user_management/client_test',
	subject,
	tokenIdentifier: `https://api.workos.com/user_management/client_test|${subject}`
});

function graph(): typeof architectureGraph.type {
	return {
		schemaVersion: 1,
		nodes: [
			{ id: 'a', label: 'A', tags: [], inputs: [], outputs: [{ id: 'out', label: 'Out' }] },
			{ id: 'b', label: 'B', tags: [], inputs: [{ id: 'in', label: 'In' }], outputs: [] }
		],
		edges: [{ id: 'edge', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }]
	};
}

test('snapshot owners can save, retrieve, update and remove only their graphs', async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const bob = t.withIdentity(identity('bob'));
	const id = await alice.mutation(api.architecture.save, { name: ' Draft ', graph: graph() });
	const saved = await alice.query(api.architecture.get, { id });
	expect(saved?.name).toBe('Draft');
	expect(validateGraph(saved?.graph)).toBe(true);
	expect(saved).not.toHaveProperty('owner');
	expect(await bob.query(api.architecture.list, {})).toEqual([]);
	expect(await bob.query(api.architecture.get, { id })).toBeNull();
	await expect(
		bob.mutation(api.architecture.save, { id, name: 'Wrong owner', graph: graph() })
	).rejects.toThrow('Snapshot not found');
	await expect(bob.mutation(api.architecture.remove, { id })).rejects.toThrow('Snapshot not found');
	await alice.mutation(api.architecture.save, { id, name: 'Updated', graph: graph() });
	expect((await alice.query(api.architecture.get, { id }))?.name).toBe('Updated');
	await alice.mutation(api.architecture.remove, { id });
	expect(await alice.query(api.architecture.list, {})).toEqual([]);
});

test('anonymous callers cannot list, read or mutate architecture snapshots', async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const id = await alice.mutation(api.architecture.save, { name: 'Private', graph: graph() });
	await expect(t.query(api.architecture.list, {})).rejects.toThrow('Sign in');
	await expect(t.query(api.architecture.get, { id })).rejects.toThrow('Sign in');
	await expect(
		t.mutation(api.architecture.save, { name: 'Guest', graph: graph() })
	).rejects.toThrow('Sign in');
	await expect(t.mutation(api.architecture.remove, { id })).rejects.toThrow('Sign in');
});

test('invalid graph identities and ports cannot corrupt new or existing snapshots', async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const original = graph();
	const id = await alice.mutation(api.architecture.save, { name: 'Original', graph: original });
	const invalid: (typeof architectureGraph.type)[] = [];
	const duplicatePort = graph();
	duplicatePort.nodes[0].outputs.push({ id: 'out', label: 'Duplicate' });
	invalid.push(duplicatePort);
	const missingPort = graph();
	missingPort.edges[0].sourcePort = 'missing';
	invalid.push(missingPort);
	const duplicateEdge = graph();
	duplicateEdge.nodes[0].outputs.push({ id: 'other', label: 'Other' });
	duplicateEdge.edges.push({ ...duplicateEdge.edges[0], sourcePort: 'other' });
	invalid.push(duplicateEdge);
	const duplicateConnection = graph();
	duplicateConnection.edges.push({ ...duplicateConnection.edges[0], id: 'other' });
	invalid.push(duplicateConnection);
	const badLevel = graph();
	badLevel.nodes[0].level = Number.NaN;
	invalid.push(badLevel);
	for (const value of invalid) {
		await expect(
			alice.mutation(api.architecture.save, { name: 'Invalid', graph: value })
		).rejects.toThrow('unique ids and valid node/port');
		await expect(
			alice.mutation(api.architecture.save, { id, name: 'Invalid', graph: value })
		).rejects.toThrow('unique ids and valid node/port');
	}
	expect(await alice.query(api.architecture.list, {})).toHaveLength(1);
	expect((await alice.query(api.architecture.get, { id }))?.graph).toEqual(original);
});

test('port connection tuples with separator characters stay distinct in persisted graphs', async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const value: typeof architectureGraph.type = {
		schemaVersion: 1,
		nodes: [
			{ id: 'a:b', label: 'A', tags: [], inputs: [], outputs: [{ id: 'c', label: 'C' }] },
			{ id: 'a', label: 'A', tags: [], inputs: [], outputs: [{ id: 'b:c', label: 'C' }] },
			{ id: 'target', label: 'Target', tags: [], inputs: [{ id: 'in', label: 'In' }], outputs: [] }
		],
		edges: [
			{ id: 'e1', source: 'a:b', sourcePort: 'c', target: 'target', targetPort: 'in' },
			{ id: 'e2', source: 'a', sourcePort: 'b:c', target: 'target', targetPort: 'in' }
		]
	};
	const id = await alice.mutation(api.architecture.save, { name: 'Distinct', graph: value });
	expect((await alice.query(api.architecture.get, { id }))?.graph).toEqual(value);
});
