import * as vscode from 'vscode';
import { ConfigurationService } from '../services/configurationService';

export class StatusBarProvider implements vscode.Disposable {
	private statusBarItem: vscode.StatusBarItem;
	private disposables: vscode.Disposable[] = [];

	constructor(private configurationService: ConfigurationService) {
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		this.statusBarItem.command = 'alfresco-javascript-console.switchProfile';
		this.disposables.push(this.statusBarItem);

		this.disposables.push(
			this.configurationService.onActiveProfileChanged(() => this.update())
		);

		this.update();
		this.statusBarItem.show();
	}

	update(): void {
		const profile = this.configurationService.getActiveProfile();
		if (profile) {
			this.statusBarItem.text = `$(server) ${profile.name}`;
			this.statusBarItem.tooltip = `${profile.serverUrl}\n${profile.username}`;
			this.statusBarItem.backgroundColor = undefined;
		} else {
			this.statusBarItem.text = '$(server) No Server';
			this.statusBarItem.tooltip = 'Click to configure an Alfresco server';
			this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
		}
	}

	dispose(): void {
		for (const d of this.disposables) {
			d.dispose();
		}
	}
}
