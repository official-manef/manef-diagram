<script lang="ts">
	import { WorkspaceFrame, WorkspaceScreen } from '$features/workspace';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<WorkspaceFrame><WorkspaceScreen surface={data.surface} /></WorkspaceFrame>
