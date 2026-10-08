<script lang="ts">
	import { WorkspaceScreen } from '$features/ecosystem';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<WorkspaceScreen surface={data.surface} />
