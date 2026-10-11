export const siteLinks = {
	origin: 'https://diagram.manef.dev',
	ecosystemOrigin: 'https://manef.dev'
} as const;
export const workspaceUrl = (surface = '') =>
	siteLinks.ecosystemOrigin + '/workspace' + (surface ? '/' + surface : '');
export const publicNavigation = [
	{ label: 'Map directory', href: '/products', external: false },
	{ label: 'Guide', href: '/guide', external: false },
	{ label: 'Audit', href: '/audit', external: false },
	{ label: 'MANEF workspace', href: workspaceUrl(), external: true }
] as const;
