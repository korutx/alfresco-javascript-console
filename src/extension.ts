import * as vscode from 'vscode';
import { AlfrescoApiService } from './services/alfrescoApiService';
import { OutputService } from './services/outputService';
import { ConfigurationService } from './services/configurationService';
import { WebviewPanelProvider } from './providers/webviewPanelProvider';
import { StatusBarProvider } from './providers/statusBarProvider';
import { addProfile, switchProfile, editProfile, deleteProfile } from './commands/profileCommands';

let alfrescoApiService: AlfrescoApiService;
let outputService: OutputService;
let configurationService: ConfigurationService;
let webviewPanelProvider: WebviewPanelProvider;
let statusBarProvider: StatusBarProvider;

export async function activate(context: vscode.ExtensionContext) {
	console.log('Alfresco JavaScript Console extension is now active!');

	// Initialize services
	outputService = new OutputService();
	configurationService = new ConfigurationService();
	await configurationService.setContext(context);
	alfrescoApiService = new AlfrescoApiService(outputService, configurationService);
	webviewPanelProvider = new WebviewPanelProvider(context.extensionUri, alfrescoApiService);
	statusBarProvider = new StatusBarProvider(configurationService);

	// Register webview provider
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('alfresco-console-panel', webviewPanelProvider)
	);

	// Register commands
	const runScriptCommand = vscode.commands.registerCommand('alfresco-javascript-console.runScript', async () => {
		await runCurrentScript();
	});

	const configureServerCommand = vscode.commands.registerCommand('alfresco-javascript-console.configureServer', async () => {
		await configureServer();
	});

	const openPanelCommand = vscode.commands.registerCommand('alfresco-javascript-console.openPanel', async () => {
		await vscode.commands.executeCommand('workbench.view.extension.alfresco-console');
	});

	const addProfileCommand = vscode.commands.registerCommand('alfresco-javascript-console.addProfile', async () => {
		await addProfile(configurationService);
	});

	const switchProfileCommand = vscode.commands.registerCommand('alfresco-javascript-console.switchProfile', async () => {
		await switchProfile(configurationService);
	});

	const editProfileCommand = vscode.commands.registerCommand('alfresco-javascript-console.editProfile', async () => {
		await editProfile(configurationService);
	});

	const deleteProfileCommand = vscode.commands.registerCommand('alfresco-javascript-console.deleteProfile', async () => {
		await deleteProfile(configurationService);
	});

	context.subscriptions.push(
		runScriptCommand,
		configureServerCommand,
		openPanelCommand,
		addProfileCommand,
		switchProfileCommand,
		editProfileCommand,
		deleteProfileCommand,
		statusBarProvider
	);
}

async function runCurrentScript() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('No active editor found');
		return;
	}

	const script = editor.document.getText();
	if (!script.trim()) {
		vscode.window.showErrorMessage('No script content found');
		return;
	}

	const isConfigured = await configurationService.isServerConfigured();
	if (!isConfigured) {
		const profiles = configurationService.getProfiles();
		const actions = profiles.length > 0
			? ['Add Profile', 'Switch Profile']
			: ['Add Profile'];
		const result = await vscode.window.showWarningMessage(
			'Alfresco server not configured.',
			...actions
		);
		if (result === 'Add Profile') {
			await addProfile(configurationService);
		} else if (result === 'Switch Profile') {
			await switchProfile(configurationService);
		}
		return;
	}

	await alfrescoApiService.executeScript(script);
}

async function configureServer() {
	const profiles = configurationService.getProfiles();

	if (profiles.length === 0) {
		await addProfile(configurationService);
		return;
	}

	const pick = await vscode.window.showQuickPick(
		[
			{ label: '$(add) Add Profile', action: 'add' },
			{ label: '$(edit) Edit Profile', action: 'edit' },
			{ label: '$(server) Switch Profile', action: 'switch' },
			{ label: '$(trash) Delete Profile', action: 'delete' },
		],
		{ placeHolder: 'Server profile management' }
	);
	if (!pick) { return; }

	switch (pick.action) {
		case 'add': await addProfile(configurationService); break;
		case 'edit': await editProfile(configurationService); break;
		case 'switch': await switchProfile(configurationService); break;
		case 'delete': await deleteProfile(configurationService); break;
	}
}

export function deactivate() {
	if (outputService) {
		outputService.dispose();
	}
}
