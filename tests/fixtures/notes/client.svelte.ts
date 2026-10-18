import { getFunctionName, type FunctionReference } from 'convex/server';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Id } from '../../../src/convex/_generated/dataModel';

type Note = { _id: Id<'notes'>; _creationTime: number; body: string; updatedAt: number };
const notes = new SvelteMap<string, Note[]>();
notes.set('alice', [
	{ _id: 'alice-note' as Id<'notes'>, _creationTime: 1, body: 'Alice private note', updatedAt: 1 }
]);
notes.set('bob', [
	{ _id: 'bob-note' as Id<'notes'>, _creationTime: 2, body: 'Bob private note', updatedAt: 2 }
]);

export const fixture = $state({
	closedClients: 0,
	holdMutations: false,
	authenticate: (_value: boolean) => {
		void _value;
	},
	queryFailure: (_value: boolean) => {
		void _value;
	},
	finishMutation: (_error?: Error) => {
		void _error;
	}
});

// The synthetic browser client replaces SDK transport, auth and cache behavior.
export class ConvexClient {
	disabled: boolean;
	closed = false;
	private subject = '';
	private failure = false;
	private confirmed = false;
	private changed = (_value: boolean) => {
		void _value;
	};
	private subscribers = new SvelteSet<() => void>();
	client = {
		localQueryResult: () => {
			if (this.failure) throw new Error('private query provider payload');
			return this.confirmed ? (notes.get(this.subject) ?? []) : undefined;
		}
	};

	constructor(_url: string, options: { disabled: boolean }) {
		this.disabled = options.disabled;
		fixture.authenticate = (value) => {
			this.confirmed = value;
			this.changed(value);
			this.notify();
		};
		fixture.queryFailure = (value) => {
			this.failure = value;
			this.notify();
		};
	}

	setAuth(
		fetchToken: (options: { forceRefreshToken: boolean }) => Promise<string | null>,
		changed: (value: boolean) => void
	) {
		this.changed = changed;
		fetchToken({ forceRefreshToken: false })
			.then((token) => {
				if (this.closed) return;
				this.subject = token ?? '';
				this.confirmed = Boolean(token);
				changed(this.confirmed);
				this.notify();
			})
			.catch(() => changed(false));
	}

	onUpdate(
		_query: unknown,
		_args: unknown,
		callback: (value: Note[]) => void,
		onError: (error: Error) => void
	) {
		const update = () => {
			try {
				const value = this.client.localQueryResult();
				if (value) callback(value);
			} catch (error) {
				onError(error as Error);
			}
		};
		this.subscribers.add(update);
		update();
		return () => this.subscribers.delete(update);
	}

	private notify() {
		for (const update of this.subscribers) update();
	}

	async mutation(
		reference: FunctionReference<'mutation'>,
		args: { id?: Id<'notes'>; body?: string }
	) {
		const owner = this.subject;
		if (fixture.holdMutations) {
			await new Promise<void>((resolve, reject) => {
				fixture.finishMutation = (error) => {
					fixture.holdMutations = false;
					if (error) reject(error);
					else resolve();
				};
			});
		}
		const rows = (notes.get(owner) ?? []).map((row) => ({ ...row }));
		const name = getFunctionName(reference);
		if (name === 'notes:create')
			rows.push({
				_id: `${owner}-${rows.length}` as Id<'notes'>,
				_creationTime: 3,
				body: args.body!.trim(),
				updatedAt: 3
			});
		else if (name === 'notes:update')
			rows.find((row) => row._id === args.id)!.body = args.body!.trim();
		else if (name === 'notes:remove')
			rows.splice(
				rows.findIndex((row) => row._id === args.id),
				1
			);
		notes.set(owner, rows);
		if (!this.closed) this.notify();
		return null;
	}

	async close() {
		this.closed = true;
		fixture.closedClients++;
		this.subscribers.clear();
	}
}
