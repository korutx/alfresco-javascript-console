import * as vscode from 'vscode';
import { AlfrescoApiService } from './services/alfrescoApiService';
import { OutputService } from './services/outputService';
import { ConfigurationService } from './services/configurationService';
import { WebviewPanelProvider } from './providers/webviewPanelProvider';

let alfrescoApiService: AlfrescoApiService;
let outputService: OutputService;
let configurationService: ConfigurationService;
let webviewPanelProvider: WebviewPanelProvider;

export function activate(context: vscode.ExtensionContext) {
	console.log('Alfresco JavaScript Console extension is now active!');

	// Initialize services
	outputService = new OutputService();
	configurationService = new ConfigurationService();
	configurationService.setContext(context);
	alfrescoApiService = new AlfrescoApiService(outputService, configurationService);
	webviewPanelProvider = new WebviewPanelProvider(context.extensionUri, alfrescoApiService);

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

	context.subscriptions.push(runScriptCommand, configureServerCommand, openPanelCommand);
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
		const result = await vscode.window.showWarningMessage(
			'Alfresco server not configured. Would you like to configure it now?',
			'Configure'
		);
		if (result === 'Configure') {
			await configureServer();
		}
		return;
	}

	await alfrescoApiService.executeScript(script);
}

async function configureServer() {
	const serverUrl = await vscode.window.showInputBox({
		prompt: 'Enter Alfresco server URL',
		placeHolder: 'https://your-alfresco-server.com/alfresco',
		value: configurationService.getServerUrl()
	});

	if (!serverUrl) {
		return;
	}

	const username = await vscode.window.showInputBox({
		prompt: 'Enter username',
		value: configurationService.getUsername()
	});

	if (!username) {
		return;
	}

	const password = await vscode.window.showInputBox({
		prompt: 'Enter password',
		password: true
	});

	if (!password) {
		return;
	}

	await configurationService.saveServerConfig(serverUrl, username, password);
	vscode.window.showInformationMessage('Alfresco server configuration saved!');
}

export function deactivate() {
	if (outputService) {
		outputService.dispose();
	}
}
