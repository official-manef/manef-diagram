<script lang="ts">
	import { ProductScreen } from '$features/directory';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ProductScreen product={data.product} />
