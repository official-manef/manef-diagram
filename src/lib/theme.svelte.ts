type Theme = 'light' | 'dark' | 'system';
const KEY = 'manef-theme-v1';
class ThemePreference {
	preference = $state<Theme>('light');
	theme = $state<'light' | 'dark'>('light');
	ready = $state(false);
	init() {
		if (this.ready || typeof window === 'undefined') return;
		try {
			const saved = localStorage.getItem(KEY);
			const legacy = localStorage.getItem('manef-diagram-theme');
			const next =
				saved ??
				(legacy === 'system'
					? 'system'
					: legacy === 'composio-dark'
						? 'dark'
						: legacy === 'composio-light'
							? 'light'
							: JSON.parse(localStorage.getItem('manef-ecosystem-demo-v1') || '{}').theme);
			if (next === 'light' || next === 'dark' || next === 'system') this.preference = next;
		} catch {
			/* Storage denial keeps the visit usable in memory. */
		}
		this.ready = true;
		this.sync();
	}
	sync() {
		this.theme =
			this.preference === 'system'
				? window.matchMedia('(prefers-color-scheme: dark)').matches
					? 'dark'
					: 'light'
				: this.preference;
	}
	setTheme(next: Theme) {
		this.preference = next;
		this.ready = true;
		this.sync();
		try {
			localStorage.setItem(KEY, next);
		} catch {
			/* Memory-only preference. */
		}
	}
}
export const themePreference = new ThemePreference();
