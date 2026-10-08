<script lang="ts">
	import { WorkspaceScreen } from '$features/workspace';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<WorkspaceScreen surface={data.surface} />
