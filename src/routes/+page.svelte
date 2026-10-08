<script lang="ts">
	import { appConfig } from '$lib/config/app';
	import { HomeScreen } from '$features/ecosystem';
</script>

<svelte:head>
	<title>{appConfig.name} — {appConfig.landing.title}</title>
</svelte:head>

<HomeScreen />
