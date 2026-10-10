import type { ArchitectureNode } from '../types';

export function tagLabel(tag: string): string {
	const index = tag.indexOf(':');
	return index > 0 ? tag.slice(index + 1) : tag;
}

export function facetChips(tags: string[]): string[] {
	const chips: string[] = [];
	for (const namespace of ['kind', 'platform', 'project']) {
		const tag = tags.find((item) => item.startsWith(`${namespace}:`));
		if (tag) chips.push(tag.slice(namespace.length + 1));
	}
	return chips;
}

/** Flat colors, closer to Obsidian's graph than a glowing palette. */
export function dotColor(node: ArchitectureNode): string {
	if (node.status === 'private') return '#9aa3b2';
	if (node.status === 'proposed') return '#d2a15a';
	if (node.tags.includes('domain')) return '#3cb7d6';
	if (node.tags.includes('brand')) return '#e0a24a';
	if (node.tags.includes('docs')) return '#d08a4a';
	if (node.tags.includes('infra')) return '#8b9bb4';
	return '#4f8cff';
}

export function filterTagGroups(
	groups: readonly (readonly [string, readonly string[]])[],
	query: string,
	sort: 'name' | 'count',
	countOf: (tag: string) => number
): [string, string[]][] {
	const needle = query.trim().toLowerCase();
	return groups
		.map(([group, tags]) => {
			const matched = tags.filter((tag) => {
				const name = tagLabel(tag);
				return !needle || `${name} ${tag}`.toLowerCase().includes(needle);
			});
			const sorted = [...matched].sort((a, b) =>
				sort === 'count' ? countOf(b) - countOf(a) || a.localeCompare(b) : a.localeCompare(b)
			);
			return [group, sorted] as [string, string[]];
		})
		.filter(([, tags]) => tags.length > 0);
}
