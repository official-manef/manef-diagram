export const issuer = 'https://api.workos.com/user_management/client_fixture';
export const session = (subject: string) => ({
	subject,
	tokenIdentifier: `${issuer}|${subject}`,
	email: 'shared@example.invalid',
	expiresAt: Date.now() + 3600000
});
export const page = $state({
	data: { auth: { enabled: true, session: session('alice') as ReturnType<typeof session> | null } }
});
