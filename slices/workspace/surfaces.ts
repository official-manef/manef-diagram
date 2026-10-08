export const workspaceSurfaces = [
	{ id: 'overview', title: 'Workspace overview', nav: 'Overview', group: 'Workspace' },
	{ id: 'mso', title: 'MSO demo', nav: 'MSO', group: 'Workspace' },
	{ id: 'diagram', title: 'Diagram demo', nav: 'Diagram', group: 'Workspace' },
	{ id: 'context', title: 'Context demo', nav: 'Context', group: 'Workspace' },
	{ id: 'registry', title: 'Catalog demo', nav: 'Catalog', group: 'Extend' },
	{ id: 'models', title: 'Models demo', nav: 'Models', group: 'Extend' },
	{ id: 'connectors', title: 'Connectors demo', nav: 'Connectors', group: 'Extend' },
	{ id: 'ops', title: 'Operations demo', nav: 'Operations', group: 'Operate' },
	{ id: 'developers', title: 'Developer playground', nav: 'Developers', group: 'Operate' },
	{ id: 'labs', title: 'Labs', nav: 'Labs', group: 'Operate' },
	{ id: 'settings', title: 'Demo settings', nav: 'Settings', group: 'Operate' }
] as const;

export type WorkspaceSurfaceId = (typeof workspaceSurfaces)[number]['id'];

const dynamicSurfaces = workspaceSurfaces.filter((item) => item.id !== 'overview');

export function workspaceSurface(id: string) {
	return dynamicSurfaces.find((item) => item.id === id);
}

export function workspaceNavGroups() {
	const groups: { label: string; items: { id: WorkspaceSurfaceId; nav: string }[] }[] = [];
	for (const item of workspaceSurfaces) {
		let group = groups.find((entry) => entry.label === item.group);
		if (!group) {
			group = { label: item.group, items: [] };
			groups.push(group);
		}
		group.items.push({ id: item.id, nav: item.nav });
	}
	return groups;
}
