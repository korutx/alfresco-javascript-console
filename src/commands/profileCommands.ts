import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';
import { Profile } from '../models/profile';

export async function addProfile(configService: ConfigurationService): Promise<void> {
	const name = await vscode.window.showInputBox({
		prompt: 'Profile name',
		placeHolder: 'e.g. Production, Dev, Staging',
		validateInput: v => v?.trim() ? undefined : 'Name is required'
	});
	if (!name) { return; }

	const serverUrl = await vscode.window.showInputBox({
		prompt: 'Alfresco server URL',
		placeHolder: 'https://your-server.com/alfresco',
		validateInput: v => v?.trim() ? undefined : 'URL is required'
	});
	if (!serverUrl) { return; }

	const username = await vscode.window.showInputBox({
		prompt: 'Username',
		validateInput: v => v?.trim() ? undefined : 'Username is required'
	});
	if (!username) { return; }

	const password = await vscode.window.showInputBox({
		prompt: 'Password',
		password: true,
		validateInput: v => v ? undefined : 'Password is required'
	});
	if (!password) { return; }

	const variantPick = await vscode.window.showQuickPick(
		[
			{ label: 'Auto-detect', value: 'auto' as const },
			{ label: 'OOTBee', value: 'ootbee' as const },
			{ label: 'fme (legacy)', value: 'fme' as const },
		],
		{ placeHolder: 'Console variant', canPickMany: false }
	);
	if (!variantPick) { return; }

	const txPick = await vscode.window.showQuickPick(
		[
			{ label: 'Read-only', value: 'readonly' as const },
			{ label: 'Read-write', value: 'readwrite' as const },
		],
		{ placeHolder: 'Default transaction type', canPickMany: false }
	);
	if (!txPick) { return; }

	const runAs = await vscode.window.showInputBox({
		prompt: 'Default "Run As" user (leave empty for current user)',
	}) ?? '';

	const profile: Profile = {
		id: configService.generateProfileId(),
		name: name.trim(),
		serverUrl: serverUrl.trim(),
		username: username.trim(),
		consoleVariant: variantPick.value,
		defaultTransaction: txPick.value,
		defaultRunAs: runAs.trim(),
	};

	await configService.addProfile(profile, password);
	vscode.window.showInformationMessage(`Profile "${profile.name}" added.`);
}

export async function switchProfile(configService: ConfigurationService): Promise<void> {
	const profiles = configService.getProfiles();
	if (profiles.length === 0) {
		const action = await vscode.window.showInformationMessage(
			'No server profiles configured.',
			'Add Profile'
		);
		if (action === 'Add Profile') {
			await addProfile(configService);
		}
		return;
	}

	const active = configService.getActiveProfile();
	const items = profiles.map(p => ({
		label: `${p.id === active?.id ? '$(check) ' : ''}${p.name}`,
		description: p.serverUrl,
		detail: p.username,
		profileId: p.id,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select a server profile',
	});
	if (!picked) { return; }

	await configService.setActiveProfile(picked.profileId);
	const profile = configService.getActiveProfile();
	if (profile) {
		vscode.window.showInformationMessage(`Switched to "${profile.name}".`);
	}
}

export async function editProfile(configService: ConfigurationService): Promise<void> {
	const profiles = configService.getProfiles();
	if (profiles.length === 0) {
		vscode.window.showInformationMessage('No server profiles to edit.');
		return;
	}

	const items = profiles.map(p => ({
		label: p.name,
		description: p.serverUrl,
		profileId: p.id,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select profile to edit',
	});
	if (!picked) { return; }

	const profile = profiles.find(p => p.id === picked.profileId);
	if (!profile) { return; }

	const fields = [
		{ label: 'Name', key: 'name' },
		{ label: 'Server URL', key: 'serverUrl' },
		{ label: 'Username', key: 'username' },
		{ label: 'Password', key: 'password' },
		{ label: 'Console Variant', key: 'consoleVariant' },
		{ label: 'Default Transaction', key: 'defaultTransaction' },
		{ label: 'Default Run As', key: 'defaultRunAs' },
	];

	const fieldPick = await vscode.window.showQuickPick(fields, {
		placeHolder: 'Select field to edit',
	});
	if (!fieldPick) { return; }

	let newPassword: string | undefined;

	switch (fieldPick.key) {
		case 'name': {
			const v = await vscode.window.showInputBox({ prompt: 'New name', value: profile.name });
			if (v === undefined) { return; }
			profile.name = v.trim();
			break;
		}
		case 'serverUrl': {
			const v = await vscode.window.showInputBox({ prompt: 'New server URL', value: profile.serverUrl });
			if (v === undefined) { return; }
			profile.serverUrl = v.trim();
			break;
		}
		case 'username': {
			const v = await vscode.window.showInputBox({ prompt: 'New username', value: profile.username });
			if (v === undefined) { return; }
			profile.username = v.trim();
			break;
		}
		case 'password': {
			const v = await vscode.window.showInputBox({ prompt: 'New password', password: true });
			if (v === undefined) { return; }
			newPassword = v;
			break;
		}
		case 'consoleVariant': {
			const v = await vscode.window.showQuickPick(
				[
					{ label: 'Auto-detect', value: 'auto' as const },
					{ label: 'OOTBee', value: 'ootbee' as const },
					{ label: 'fme (legacy)', value: 'fme' as const },
				],
				{ placeHolder: 'Console variant' }
			);
			if (!v) { return; }
			profile.consoleVariant = v.value;
			break;
		}
		case 'defaultTransaction': {
			const v = await vscode.window.showQuickPick(
				[
					{ label: 'Read-only', value: 'readonly' as const },
					{ label: 'Read-write', value: 'readwrite' as const },
				],
				{ placeHolder: 'Default transaction type' }
			);
			if (!v) { return; }
			profile.defaultTransaction = v.value;
			break;
		}
		case 'defaultRunAs': {
			const v = await vscode.window.showInputBox({ prompt: 'Default "Run As" user', value: profile.defaultRunAs });
			if (v === undefined) { return; }
			profile.defaultRunAs = v.trim();
			break;
		}
	}

	await configService.updateProfile(profile, newPassword);
	vscode.window.showInformationMessage(`Profile "${profile.name}" updated.`);
}

export async function deleteProfile(configService: ConfigurationService): Promise<void> {
	const profiles = configService.getProfiles();
	if (profiles.length === 0) {
		vscode.window.showInformationMessage('No server profiles to delete.');
		return;
	}

	const items = profiles.map(p => ({
		label: p.name,
		description: p.serverUrl,
		profileId: p.id,
	}));

	const picked = await vscode.window.showQuickPick(items, {
		placeHolder: 'Select profile to delete',
	});
	if (!picked) { return; }

	const confirm = await vscode.window.showWarningMessage(
		`Delete profile "${picked.label}"?`,
		{ modal: true },
		'Delete'
	);
	if (confirm !== 'Delete') { return; }

	await configService.deleteProfile(picked.profileId);
	vscode.window.showInformationMessage(`Profile "${picked.label}" deleted.`);
}
