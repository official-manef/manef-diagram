import { convexTest } from 'convex-test';
import { expect, test } from 'vitest';
import schema, { architectureGraph } from '../../../convex/schema';
import { api } from '../../../convex/_generated/api';
import { validateGraph } from '$features/architecture-inventory';

const modules = import.meta.glob('../../../convex/**/*.*s');
const workosIssuer = 'https://api.workos.com/user_management/client_test';
const identity = (subject: string, issuer = workosIssuer) => ({
	issuer,
	subject,
	tokenIdentifier: `${issuer}|${subject}`,
	email: 'shared@example.com'
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

test.each([
	{
		caseName: 'the same subject under different WorkOS issuers',
		otherIdentity: identity('alice', 'https://api.workos.com/user_management/client_other')
	},
	{
		caseName: 'different WorkOS subjects sharing an email',
		otherIdentity: identity('bob')
	}
])('snapshots stay isolated for $caseName', async ({ otherIdentity }) => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const other = t.withIdentity(otherIdentity);
	const aliceId = await alice.mutation(api.architecture.save, {
		name: 'Alice private snapshot',
		graph: graph()
	});
	const otherGraph = graph();
	otherGraph.nodes[0].label = 'Other private node';
	const otherId = await other.mutation(api.architecture.save, {
		name: 'Other private snapshot',
		graph: otherGraph
	});
	const missingId = await alice.mutation(api.architecture.save, {
		name: 'Deleted snapshot',
		graph: graph()
	});
	await alice.mutation(api.architecture.remove, { id: missingId });
	const before = await t.run(async (ctx) => ({
		alice: await ctx.db.get('architectureSnapshots', aliceId),
		other: await ctx.db.get('architectureSnapshots', otherId)
	}));

	for (const { caller, ownId, foreignId } of [
		{ caller: alice, ownId: aliceId, foreignId: otherId },
		{ caller: other, ownId: otherId, foreignId: aliceId }
	]) {
		expect((await caller.query(api.architecture.list, {})).map((row) => row._id)).toEqual([ownId]);
		const attemptedGraph = graph();
		attemptedGraph.nodes[0].label = 'Unauthorized replacement';
		for (const id of [foreignId, missingId]) {
			expect(await caller.query(api.architecture.get, { id })).toBeNull();
			await expect(
				caller.mutation(api.architecture.save, {
					id,
					name: 'Unauthorized replacement',
					graph: attemptedGraph
				})
			).rejects.toHaveProperty('data', {
				code: 'NOT_FOUND',
				message: 'Snapshot not found.'
			});
			await expect(caller.mutation(api.architecture.remove, { id })).rejects.toHaveProperty(
				'data',
				{
					code: 'NOT_FOUND',
					message: 'Snapshot not found.'
				}
			);
		}
	}

	expect(
		await t.run(async (ctx) => ({
			alice: await ctx.db.get('architectureSnapshots', aliceId),
			other: await ctx.db.get('architectureSnapshots', otherId)
		}))
	).toEqual(before);
	expect(await alice.query(api.architecture.get, { id: aliceId })).toEqual(
		expect.objectContaining({ name: 'Alice private snapshot', graph: graph() })
	);
	expect(await other.query(api.architecture.get, { id: otherId })).toEqual(
		expect.objectContaining({ name: 'Other private snapshot', graph: otherGraph })
	);
	expect((await alice.query(api.architecture.list, {})).map((row) => row._id)).toEqual([aliceId]);
	expect((await other.query(api.architecture.list, {})).map((row) => row._id)).toEqual([otherId]);
});

test('anonymous callers cannot list, read or mutate architecture snapshots', async () => {
	const t = convexTest(schema, modules);
	const alice = t.withIdentity(identity('alice'));
	const id = await alice.mutation(api.architecture.save, { name: 'Private', graph: graph() });
	const before = await t.run((ctx) => ctx.db.get('architectureSnapshots', id));
	await expect(t.query(api.architecture.list, {})).rejects.toThrow('Sign in');
	await expect(t.query(api.architecture.get, { id })).rejects.toThrow('Sign in');
	await expect(
		t.mutation(api.architecture.save, { name: 'Guest', graph: graph() })
	).rejects.toThrow('Sign in');
	await expect(
		t.mutation(api.architecture.save, { id, name: 'Anonymous overwrite', graph: graph() })
	).rejects.toThrow('Sign in');
	await expect(t.mutation(api.architecture.remove, { id })).rejects.toThrow('Sign in');
	expect(await t.run((ctx) => ctx.db.get('architectureSnapshots', id))).toEqual(before);
	expect((await alice.query(api.architecture.list, {})).map((row) => row._id)).toEqual([id]);
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
