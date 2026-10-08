<script lang="ts">
	import { WorkspaceFrame } from '$features/workspace';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<WorkspaceFrame>
	{@render children()}
</WorkspaceFrame>
