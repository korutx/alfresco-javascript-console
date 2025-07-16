import * as vscode from 'vscode';
import { AlfrescoApiService } from '../services/alfrescoApiService';

export class WebviewPanelProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'alfresco-console-panel';
	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		private readonly _alfrescoApiService: AlfrescoApiService
	) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [this._extensionUri]
		};

		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (data) => {
			switch (data.type) {
				case 'runScript':
					await this._handleRunScript(data.params);
					break;
				case 'getActiveScript':
					this._handleGetActiveScript();
					break;
			}
		});
	}

	private async _handleRunScript(params: any) {
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

		await this._alfrescoApiService.executeScript(script, params);
	}

	private _handleGetActiveScript() {
		const editor = vscode.window.activeTextEditor;
		const script = editor ? editor.document.getText() : '';
		
		this._view?.webview.postMessage({
			type: 'activeScript',
			script: script
		});
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alfresco Console</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 10px;
            margin: 0;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input, select, textarea {
            width: 100%;
            padding: 8px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            box-sizing: border-box;
        }
        
        textarea {
            min-height: 100px;
            resize: vertical;
            font-family: var(--vscode-editor-font-family);
        }
        
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 3px;
            cursor: pointer;
            width: 100%;
            font-size: 14px;
            margin-top: 10px;
        }
        
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }
        
        .run-button {
            background-color: var(--vscode-debugIcon-startForeground, #4CAF50);
            font-weight: bold;
        }
        
        .section {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 15px;
        }
        
        .section-title {
            font-weight: bold;
            margin-bottom: 10px;
            color: var(--vscode-textLink-foreground);
        }
        
        .info {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="section">
        <div class="section-title">🚀 Script Execution</div>
        <button id="runButton" class="run-button">Run in Alfresco</button>
    </div>

    <div class="section">
        <div class="section-title">⚙️ Execution Parameters</div>
        
        <div class="form-group">
            <label for="transaction">Transaction Type:</label>
            <select id="transaction">
                <option value="readonly">Read Only</option>
                <option value="readwrite">Read Write</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="runas">Run As User:</label>
            <input type="text" id="runas" placeholder="Leave empty for current user">
            <div class="info">Execute script as a different user</div>
        </div>
        
        <div class="form-group">
            <label for="spaceNodeRef">Space Node Reference:</label>
            <input type="text" id="spaceNodeRef" placeholder="workspace://SpacesStore/...">
            <div class="info">Target space for script execution context</div>
        </div>
        
        <div class="form-group">
            <label for="documentNodeRef">Document Node Reference:</label>
            <input type="text" id="documentNodeRef" placeholder="workspace://SpacesStore/...">
            <div class="info">Target document for script execution context</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">📝 FTL Template (Optional)</div>
        <div class="form-group">
            <textarea id="template" placeholder="Enter FreeMarker template here..."></textarea>
            <div class="info">FreeMarker template for result formatting</div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">🔗 URL Arguments (Optional)</div>
        <div class="form-group">
            <input type="text" id="urlargs" placeholder="key1=value1&key2=value2">
            <div class="info">Additional URL parameters for the script</div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('runButton').addEventListener('click', () => {
            const params = {
                transaction: document.getElementById('transaction').value,
                runas: document.getElementById('runas').value,
                spaceNodeRef: document.getElementById('spaceNodeRef').value,
                documentNodeRef: document.getElementById('documentNodeRef').value,
                template: document.getElementById('template').value,
                urlargs: document.getElementById('urlargs').value
            };
            
            vscode.postMessage({
                type: 'runScript',
                params: params
            });
        });

        // Load configuration values on startup
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'activeScript':
                    // Update UI if needed based on active script
                    break;
            }
        });
        
        // Request active script on load
        vscode.postMessage({ type: 'getActiveScript' });
    </script>
</body>
</html>`;
	}
}