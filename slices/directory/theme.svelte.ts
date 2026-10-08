const KEY = 'manef-ecosystem-demo-v1';

class ThemePreference {
	theme = $state<'light' | 'dark'>('light');
	ready = false;

	init() {
		if (this.ready || typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) {
				const saved = JSON.parse(raw) as { theme?: string };
				this.theme = saved.theme === 'dark' ? 'dark' : 'light';
			}
		} catch {
			this.theme = 'light';
		}
		this.ready = true;
	}

	setTheme(next: 'light' | 'dark') {
		this.theme = next;
		this.ready = true;
		if (typeof localStorage === 'undefined') return;
		try {
			const raw = localStorage.getItem(KEY);
			const saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
			localStorage.setItem(KEY, JSON.stringify({ ...saved, theme: next }));
		} catch {
			// The workspace store reports memory-only when its own write fails.
		}
	}
}

export const themePreference = new ThemePreference();
