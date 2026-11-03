import type { ArchitectureGraph } from '../types';

/**
 * Claiming a portable diagram.
 *
 * A visitor who opens a shared or embedded portable link can claim the graph
 * into their signed-in account through the Convex `architecture.snapshots`
 * API. These helpers stay pure so the claim rules are unit-testable without a
 * Convex deployment.
 */

export type ClaimState = {
	sharedLink: boolean;
	authEnabled: boolean;
	convexConfigured: boolean;
};

/** Claiming needs a portable link, a signed-in account backend and Convex. */
export function canClaim(state: ClaimState): boolean {
	return state.sharedLink && state.authEnabled && state.convexConfigured;
}

const MAX_CLAIM_NAME = 160;

/** Derive the snapshot name from the shared document title or the graph. */
export function claimName(title: string | undefined, graph: ArchitectureGraph): string {
	const fromTitle = title?.trim();
	if (fromTitle) return fromTitle.slice(0, MAX_CLAIM_NAME);
	const fromNode = graph.nodes[0]?.label?.trim();
	if (fromNode) return `${fromNode.slice(0, MAX_CLAIM_NAME - 10)} diagram`;
	return 'Claimed diagram';
}
