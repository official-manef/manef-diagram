import { expect, it } from 'vitest';
import { workspaceFrameAncestors, workspaceHostOrigin, workspaceParentOrigin } from './embedding';

it('keeps navigation messages on approved MANEF owners', () => {
	expect(workspaceParentOrigin('https://manef.dev/workspace', 'https://diagram.manef.dev')).toBe(
		'https://manef.dev'
	);
	expect(
		workspaceParentOrigin('https://staging.manef.dev/workspace', 'https://diagram.manef.dev')
	).toBe('https://staging.manef.dev');
	expect(workspaceParentOrigin('', 'https://diagram.manef.dev')).toBe('https://manef.dev');
	for (const referrer of [
		'https://manef.dev.evil.example/workspace',
		'http://manef.dev/workspace',
		'https://user:password@manef.dev/workspace',
		'not a URL',
		'file:///workspace'
	]) {
		expect(workspaceParentOrigin(referrer, 'https://diagram.manef.dev')).toBeNull();
	}
});

it('allows local integration without trusting loopback hosts on a hosted Diagram', () => {
	for (const parent of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
		expect(workspaceParentOrigin(parent + '/workspace', 'http://localhost:5173')).toBe(parent);
		expect(workspaceParentOrigin(parent + '/workspace', 'https://diagram.manef.dev')).toBeNull();
	}
	expect(workspaceParentOrigin('http://local.example:3000', 'http://localhost:5173')).toBeNull();
});

it('permits local framing only in development while retaining both hosted owners', () => {
	expect(workspaceFrameAncestors(false)).toBe("'self' https://manef.dev https://staging.manef.dev");
	expect(workspaceFrameAncestors(true)).toBe(
		"'self' https://manef.dev https://staging.manef.dev http://localhost:* http://127.0.0.1:*"
	);
});

it('accepts host announcements only from the actual approved parent window', () => {
	const parent = {};
	const event = {
		origin: 'http://127.0.0.1:3000',
		source: parent,
		data: { type: 'manef-workspace-host' }
	};
	expect(workspaceHostOrigin(event, parent, 'http://localhost:5173')).toBe(event.origin);
	expect(workspaceHostOrigin(event, {}, 'http://localhost:5173')).toBeNull();
	expect(workspaceHostOrigin(event, parent, 'https://diagram.manef.dev')).toBeNull();
	expect(
		workspaceHostOrigin(
			{ ...event, origin: 'https://evil.example' },
			parent,
			'http://localhost:5173'
		)
	).toBeNull();
	for (const data of [null, [], 'host', { type: 'manef-workspace-navigation' }])
		expect(workspaceHostOrigin({ ...event, data }, parent, 'http://localhost:5173')).toBeNull();
	expect(
		workspaceHostOrigin(
			{ ...event, origin: 'https://staging.manef.dev' },
			parent,
			'https://diagram.manef.dev'
		)
	).toBe('https://staging.manef.dev');
});
