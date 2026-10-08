<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { ecosystem } from './store.svelte';
	import { workspaceNavGroups, type WorkspaceSurfaceId } from './surfaces';
	import '$lib/styles/ecosystem.css';

	let { children }: { children: import('svelte').Snippet } = $props();
	let paletteQuery = $state('');
	let supportText = $state('');
	let supportLog = $state<{ role: 'you' | 'demo'; text: string }[]>([
		{
			role: 'demo',
			text: 'This chat is a simulation. It does not reach AIRIN, a model, or a person.'
		}
	]);

	const path = $derived(page.url.pathname);
	const crumb = $derived(
		path === '/workspace' ? 'Overview' : (path.split('/').at(-1) ?? 'Workspace')
	);
	const go = (surface: WorkspaceSurfaceId) =>
		surface === 'overview' ? resolve('/workspace') : resolve('/workspace/[surface]', { surface });
	const groups = workspaceNavGroups().map((group) => {
		const items = group.items.map((item) => ({ nav: item.nav, href: go(item.id) }));
		if (group.label === 'Operate') {
			const settings = items.pop();
			items.push({ nav: 'Audit', href: resolve('/audit') });
			if (settings) items.push(settings);
		}
		return { label: group.label, items };
	});
	const commands = [
		{ label: 'Home', href: resolve('/') },
		{ label: 'Products', href: resolve('/products') },
		{ label: 'Guide', href: resolve('/guide') },
		{ label: 'Audit', href: resolve('/audit') },
		{ label: 'Public map', href: resolve('/app') },
		...groups.flatMap((group) => group.items.map((item) => ({ label: item.nav, href: item.href })))
	];
	const matches = $derived(
		commands.filter((item) => item.label.toLowerCase().includes(paletteQuery.trim().toLowerCase()))
	);

	onMount(() => {
		ecosystem.init();
		const onKey = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				ecosystem.palette = true;
			} else if (event.key === 'Escape') {
				ecosystem.palette = false;
				ecosystem.supportOpen = false;
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function ask() {
		const text = supportText.trim();
		if (!text) return;
		supportText = '';
		supportLog = [
			...supportLog,
			{ role: 'you', text },
			{
				role: 'demo',
				text: 'Kept in this panel only. No ticket was opened and no agent was called.'
			}
		];
	}
</script>

<div class="eco" data-theme={ecosystem.theme}>
	<div class="app-shell">
		<aside class="sidebar">
			<a class="brand" href={resolve('/')}>MANEF</a>
			<label class="field">
				Demo workspace
				<select
					aria-label="Demo workspace"
					value={ecosystem.active}
					onchange={(event) => ecosystem.switchTo(event.currentTarget.value)}
				>
					<option>Product studio</option>
					<option>Sandbox</option>
				</select>
			</label>
			{#each groups as group (group.label)}
				<p class="nav-label">{group.label}</p>
				{#each group.items as item (item.href)}
					<a
						class="nav-item"
						href={item.href}
						aria-current={path === item.href ? 'page' : undefined}>{item.nav}</a
					>
				{/each}
			{/each}
			<div class="side-foot">
				<button class="btn small" type="button" onclick={() => (ecosystem.palette = true)}
					>Search · Ctrl K</button
				>
				<button
					class="btn small"
					type="button"
					onclick={() => (ecosystem.supportOpen = !ecosystem.supportOpen)}
				>
					Simulated support
				</button>
				<button
					class="btn small"
					type="button"
					onclick={() => ecosystem.setTheme(ecosystem.theme === 'dark' ? 'light' : 'dark')}
				>
					{ecosystem.theme === 'dark' ? 'Light theme' : 'Dark theme'}
				</button>
			</div>
		</aside>
		<div class="app-main">
			<p class="crumbs">
				<a href={resolve('/')}>Home</a> <span>/</span> <span>Workspace</span> <span>/</span>
				<span>{crumb}</span>
			</p>
			<p class="notice" style="margin: 14px 0 18px">
				Simulation. Nothing here installs software, calls a model, changes DNS, or edits the public
				map.
			</p>
			{#if ecosystem.memoryOnly}
				<p class="notice">
					This browser could not store the demo. It stays in memory for this visit.
				</p>
			{/if}
			{@render children()}
		</div>
	</div>

	{#if ecosystem.palette}
		<dialog open aria-label="Command palette" onclose={() => (ecosystem.palette = false)}>
			<div class="dialog-body">
				<label class="search">
					<span class="muted">Pages</span>
					<input aria-label="Search pages" bind:value={paletteQuery} />
				</label>
				<div class="commands">
					{#each matches as item (item.href + item.label)}
						<a href={item.href} onclick={() => (ecosystem.palette = false)}>{item.label}</a>
					{:else}
						<p class="muted">No page matches.</p>
					{/each}
				</div>
				<button class="btn small" type="button" onclick={() => (ecosystem.palette = false)}
					>Close</button
				>
			</div>
		</dialog>
	{/if}

	{#if ecosystem.supportOpen}
		<aside class="card support-panel" aria-label="Simulated support">
			<strong>Simulated support</strong>
			<p class="muted">Not AIRIN. Not a live inbox.</p>
			{#each supportLog as line, index (index)}
				<p><span class="pill">{line.role}</span> {line.text}</p>
			{/each}
			<form
				class="stack"
				onsubmit={(event) => {
					event.preventDefault();
					ask();
				}}
			>
				<label class="field">
					Message
					<input bind:value={supportText} />
				</label>
				<div class="row">
					<button class="btn small primary" type="submit">Send</button>
					<button class="btn small" type="button" onclick={() => (ecosystem.supportOpen = false)}
						>Close</button
					>
				</div>
			</form>
		</aside>
	{/if}

	{#if ecosystem.toast}
		<button class="toast" type="button" onclick={() => ecosystem.clearToast()}
			>{ecosystem.toast}</button
		>
	{/if}
</div>
