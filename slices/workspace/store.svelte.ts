import { themePreference } from '$features/directory';
import {
	addContext,
	addDomainPlan,
	connectService,
	createDemoState,
	installApp,
	linkDemoNodes,
	moveDemoNode,
	renameDemoEdge,
	replaceDemoGraph,
	runDemoWorkflow,
	saveRouting,
	toggleReview,
	uninstallApp,
	unlinkDemoEdge,
	updateNotes,
	type WorkspaceState
} from './logic';

const KEY = 'manef-ecosystem-demo-v1';

type Saved = {
	active: string;
	theme: 'light' | 'dark';
	workspaces: Record<string, WorkspaceState>;
};

function fresh(): Record<string, WorkspaceState> {
	return {
		'Product studio': createDemoState('Product studio'),
		Sandbox: createDemoState('Sandbox')
	};
}

class EcosystemStore {
	active = $state('Product studio');
	theme = $state<'light' | 'dark'>('light');
	workspaces = $state<Record<string, WorkspaceState>>(fresh());
	toast = $state('');
	palette = $state(false);
	supportOpen = $state(false);
	loaded = $state(false);
	memoryOnly = $state(false);

	current = $derived(this.workspaces[this.active] ?? createDemoState(this.active));

	init() {
		if (this.loaded || typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const saved = JSON.parse(raw) as Saved;
				if (saved.workspaces && saved.active && saved.workspaces[saved.active]) {
					this.workspaces = saved.workspaces;
					this.active = saved.active;
					this.theme = themePreference.ready
						? themePreference.theme
						: saved.theme === 'dark'
							? 'dark'
							: 'light';
					themePreference.theme = this.theme;
					themePreference.ready = true;
				}
			}
		} catch {
			this.memoryOnly = true;
		}
		this.loaded = true;
	}

	private commit(next: WorkspaceState, message?: string) {
		this.workspaces = { ...this.workspaces, [this.active]: { ...next, workspace: this.active } };
		if (message) this.toast = message;
		this.persist();
	}

	persist() {
		if (typeof localStorage === 'undefined') return;
		const payload: Saved = { active: this.active, theme: this.theme, workspaces: this.workspaces };
		try {
			localStorage.setItem(KEY, JSON.stringify(payload));
			this.memoryOnly = false;
		} catch {
			this.memoryOnly = true;
		}
	}

	switchTo(name: string) {
		if (!this.workspaces[name]) {
			this.workspaces = { ...this.workspaces, [name]: createDemoState(name) };
		}
		this.active = name;
		this.toast = `${name} is the demo workspace. It does not change the public map.`;
		this.persist();
	}

	setTheme(theme: 'light' | 'dark') {
		this.theme = theme;
		themePreference.theme = theme;
		themePreference.ready = true;
		this.persist();
	}

	install(id: string) {
		const next = installApp(this.current, id);
		if (next === this.current) return;
		this.commit(next, 'Installed in this demo. MSO and the demo diagram can see it.');
	}

	uninstall(id: string) {
		this.commit(uninstallApp(this.current, id), 'Removed from this demo.');
	}

	connect(id: string, on: boolean) {
		this.commit(
			connectService(this.current, id, on),
			on ? 'Marked connected in the demo.' : 'Marked disconnected.'
		);
	}

	addContext(label: string, notes: string, kind = 'document') {
		const next = addContext(this.current, label, notes, kind);
		if (next === this.current) return;
		this.commit(next, 'Context added to the demo graph.');
	}

	editNotes(id: string, notes: string) {
		this.commit(updateNotes(this.current, id, notes));
	}

	place(id: string, x: number, y: number) {
		const next = moveDemoNode(this.current, id, x, y);
		if (next === this.current) return;
		this.workspaces = { ...this.workspaces, [this.active]: next };
		this.persist();
	}

	link(source: string, target: string, label: string) {
		const next = linkDemoNodes(this.current, source, target, label);
		if (next === this.current) {
			this.toast = 'That demo link was rejected. Use two different nodes and a new direction.';
			return;
		}
		this.commit(next, 'Demo link added.');
	}

	unlink(id: string) {
		this.commit(unlinkDemoEdge(this.current, id), 'Demo link removed.');
	}

	renameLink(id: string, label: string) {
		const next = renameDemoEdge(this.current, id, label);
		if (next === this.current) return;
		this.commit(next, 'Demo link renamed.');
	}

	review(id: string) {
		this.commit(toggleReview(this.current, id));
	}

	importGraph(text: string) {
		if (text.length > 20_000) throw new Error('Import is too large.');
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new Error('Import must be JSON.');
		}
		this.commit(replaceDemoGraph(this.current, parsed), 'Demo graph replaced in this browser.');
	}

	clearToast() {
		this.toast = '';
	}

	saveRouting(primary: string, fallback: string, policy: string) {
		this.commit(
			saveRouting(this.current, { primary, fallback, policy }),
			'Routing saved in this browser.'
		);
	}

	run() {
		this.commit(
			runDemoWorkflow(this.current),
			'Demo run stored a memory node. No model was called.'
		);
	}

	planDomain(host: string) {
		const next = addDomainPlan(this.current, host);
		if (next === this.current) return;
		this.commit(next, 'Plan saved locally. No domain was provisioned.');
	}

	toggleSignIn() {
		const profile = { ...this.current.profile, signedIn: !this.current.profile.signedIn };
		this.commit(
			{ ...this.current, profile },
			profile.signedIn ? 'Simulated sign-in. This is not MANEF sign-in.' : 'Simulated sign-out.'
		);
	}

	reset() {
		this.commit(createDemoState(this.active), 'Demo workspace reset.');
	}
}

export const ecosystem = new EcosystemStore();
