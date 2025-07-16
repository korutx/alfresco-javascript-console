import * as vscode from 'vscode';

export class ConfigurationService {
	private static readonly CONFIG_SECTION = 'alfrescoJsConsole';
	private static readonly SECRET_KEY_PASSWORD = 'alfrescoPassword';
	private context?: vscode.ExtensionContext;

	setContext(context: vscode.ExtensionContext): void {
		this.context = context;
	}

	getServerUrl(): string {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<string>('server.url', '');
	}

	getUsername(): string {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<string>('server.username', '');
	}

	async getPassword(): Promise<string> {
		if (!this.context) {
			return '';
		}
		const password = await this.context.secrets.get(ConfigurationService.SECRET_KEY_PASSWORD);
		return password || '';
	}

	getDefaultTransaction(): 'readonly' | 'readwrite' {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<'readonly' | 'readwrite'>('execution.defaultTransaction', 'readonly');
	}

	getDefaultRunAs(): string {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<string>('execution.defaultRunAs', '');
	}

	async saveServerConfig(serverUrl: string, username: string, password: string): Promise<void> {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		
		await config.update('server.url', serverUrl, vscode.ConfigurationTarget.Global);
		await config.update('server.username', username, vscode.ConfigurationTarget.Global);
		if (this.context) {
			await this.context.secrets.store(ConfigurationService.SECRET_KEY_PASSWORD, password);
		}
	}

	async isServerConfigured(): Promise<boolean> {
		const serverUrl = this.getServerUrl();
		const username = this.getUsername();
		const password = await this.getPassword();
		
		return !!(serverUrl && username && password);
	}

	async clearServerConfig(): Promise<void> {
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		
		await config.update('server.url', undefined, vscode.ConfigurationTarget.Global);
		await config.update('server.username', undefined, vscode.ConfigurationTarget.Global);
		if (this.context) {
			await this.context.secrets.delete(ConfigurationService.SECRET_KEY_PASSWORD);
		}
	}
}