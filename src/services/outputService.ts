import * as vscode from 'vscode';
import { IOutputService } from '../shared/interfaces';

export class OutputService implements IOutputService {
	private outputChannel: vscode.OutputChannel;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Alfresco Console');
	}

	appendLine(message: string): void {
		this.outputChannel.appendLine(message);
		this.outputChannel.show(true);
	}

	append(message: string): void {
		this.outputChannel.append(message);
		this.outputChannel.show(true);
	}

	clear(): void {
		this.outputChannel.clear();
	}

	show(): void {
		this.outputChannel.show();
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}