import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { OutputService } from './outputService';
import { ConfigurationService } from './configurationService';

export interface ScriptExecutionParams {
	script: string;
	template?: string;
	spaceNodeRef?: string;
	transaction?: 'readonly' | 'readwrite';
	runas?: string;
	urlargs?: string;
	documentNodeRef?: string;
}

export interface ExecutionResult {
	printOutput?: string[];
	result?: any[];
	dumpOutput?: string[];
	webscriptPerf?: string;
	scriptPerf?: string;
	spaceNodeRef?: string;
	renderedTemplate?: string;
	spacePath?: string;
	scriptOffset?: string | number;
	error?: string;
}

export class AlfrescoApiService {
	private resultChannels = new Map<string, string>();
	private pollingStates = new Map<string, { shouldStop: boolean; lastPrintIndex: number }>();

	constructor(
		private outputService: OutputService,
		private configurationService: ConfigurationService
	) {}

	async executeScript(script: string, params?: Partial<ScriptExecutionParams>): Promise<void> {
		const serverUrl = this.configurationService.getServerUrl();
		const username = this.configurationService.getUsername();
		const password = await this.configurationService.getPassword();

		if (!serverUrl || !username || !password) {
			this.outputService.appendLine('Error: Server configuration missing');
			return;
		}

		const resultChannel = Date.now().toString();
		this.resultChannels.set(resultChannel, resultChannel);
		this.pollingStates.set(resultChannel, { shouldStop: false, lastPrintIndex: 0 });

		const executionParams: ScriptExecutionParams = {
			script,
			template: params?.template || '',
			spaceNodeRef: params?.spaceNodeRef || '',
			transaction: params?.transaction || this.configurationService.getDefaultTransaction(),
			runas: params?.runas || this.configurationService.getDefaultRunAs(),
			urlargs: params?.urlargs || '',
			documentNodeRef: params?.documentNodeRef || '',
			...params
		};

		this.outputService.clear();
		this.outputService.appendLine('🚀 Executing Alfresco script...');
		this.outputService.appendLine('');

		// Start polling immediately, then execute script
		this.fetchExecutionResult(serverUrl, username, password, resultChannel);
		
		try {
			await this.executeScriptRequest(serverUrl, username, password, executionParams, resultChannel);
		} catch (error) {
			this.outputService.appendLine(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
		} finally {
			// Stop polling when script execution completes (success or error)
			const pollingState = this.pollingStates.get(resultChannel);
			if (pollingState) {
				pollingState.shouldStop = true;
			}
		}
	}

	private async executeScriptRequest(
		serverUrl: string,
		username: string,
		password: string,
		params: ScriptExecutionParams,
		resultChannel: string
	): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const url = new URL(`${serverUrl}/s/de/fme/jsconsole/execute`);
			const isHttps = url.protocol === 'https:';
			
			const postData = JSON.stringify({
				script: params.script,
				template: params.template || '',
				spaceNodeRef: params.spaceNodeRef || '',
				transaction: params.transaction || 'readonly',
				runas: params.runas || '',
				urlargs: params.urlargs || '',
				documentNodeRef: params.documentNodeRef || '',
				resultChannel
			});

			const options = {
				hostname: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData),
					'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
				},
				rejectUnauthorized: false // For self-signed certificates
			};

			const client = isHttps ? https : http;
			const req = client.request(options, (res) => {
				let responseData = '';

				res.on('data', (chunk) => {
					responseData += chunk.toString();
				});

				res.on('end', () => {
					if (res.statusCode === 200) {
						try {
							const result = JSON.parse(responseData);
							// Display the final complete response
							this.displayFinalExecutionResult(result, resultChannel);
							resolve();
						} catch (error) {
							this.outputService.appendLine('✅ Script execution completed (response parsing failed)');
							resolve();
						}
					} else {
						reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
					}
				});
			});

			req.on('error', (error) => {
				reject(error);
			});

			req.write(postData);
			req.end();
		});
	}

	private displayPrintOutput(printOutput: string[]): void {
		for (const line of printOutput) {
			this.outputService.appendLine(line);
		}
	}

	private displayFinalExecutionResult(result: ExecutionResult, resultChannel: string): void {
		const pollingState = this.pollingStates.get(resultChannel);
		
		// Stop polling immediately and wait a bit to let any in-flight requests finish
		if (pollingState) {
			pollingState.shouldStop = true;
		}
		
		// Wait a moment for any in-flight polling request to complete
		setTimeout(() => {
			// Display any remaining output that wasn't shown by polling
			if (result.printOutput && result.printOutput.length > 0) {
				const lastIndex = pollingState ? pollingState.lastPrintIndex : 0;
				const remainingOutput = result.printOutput.slice(lastIndex);
				
				if (remainingOutput.length > 0) {
					this.displayPrintOutput(remainingOutput);
					// Update the last index to prevent future display
					if (pollingState) {
						pollingState.lastPrintIndex = result.printOutput.length;
					}
				}
			}
			
			// Only show final results section if we have meaningful data
			const hasResults = result.scriptPerf || result.webscriptPerf || result.spacePath || 
							  (result.result && result.result.length > 0) || result.error;
			
			if (hasResults) {
				this.outputService.appendLine('');
				this.outputService.appendLine('✅ Script execution completed');

				this.outputService.appendLine('📊 Execution Results:');
				this.outputService.appendLine('─'.repeat(50));
				
				if (result.scriptPerf) {
					this.outputService.appendLine(`⏱️  Script Performance: ${result.scriptPerf}ms`);
				}
				
				if (result.webscriptPerf) {
					this.outputService.appendLine(`🔧 Webscript Performance: ${result.webscriptPerf}ms`);
				}
				
				if (result.spacePath) {
					this.outputService.appendLine(`📁 Space Path: ${result.spacePath}`);
				}

				if (result.result && result.result.length > 0) {
					this.outputService.appendLine(`📋 Result: ${JSON.stringify(result.result, null, 2)}`);
				}

				if (result.error) {
					this.outputService.appendLine(`❌ Error: ${result.error}`);
				}
			}
		}, 10); // Small delay to let polling finish
	}

	private displayFinalResult(result: ExecutionResult): void {
		this.outputService.appendLine('');
		this.outputService.appendLine('📊 Final Results:');
		this.outputService.appendLine('─'.repeat(50));
		
		if (result.scriptPerf) {
			this.outputService.appendLine(`⏱️  Script Performance: ${result.scriptPerf}ms`);
		}
		
		if (result.webscriptPerf) {
			this.outputService.appendLine(`🔧 Webscript Performance: ${result.webscriptPerf}ms`);
		}
		
		if (result.spacePath) {
			this.outputService.appendLine(`📁 Space Path: ${result.spacePath}`);
		}

		if (result.result && result.result.length > 0) {
			this.outputService.appendLine(`📝 Result: ${JSON.stringify(result.result, null, 2)}`);
		}

		if (result.error) {
			this.outputService.appendLine(`❌ Error: ${result.error}`);
		}
	}

	private fetchExecutionResult(
		serverUrl: string,
		username: string,
		password: string,
		resultChannel: string
	): void {
		const pollResult = () => {
			const pollingState = this.pollingStates.get(resultChannel);
			if (!pollingState || pollingState.shouldStop) {
				console.log('Stopping polling for channel:', resultChannel);
				this.pollingStates.delete(resultChannel);
				return;
			}

			console.log('Polling result for channel:', resultChannel);
			const url = new URL(`${serverUrl}/s/de/fme/jsconsole/${resultChannel}/executionResult`);
			const isHttps = url.protocol === 'https:';

			const options = {
				hostname: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname,
				method: 'GET',
				headers: {
					'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
				},
				rejectUnauthorized: false
			};

			const client = isHttps ? https : http;
			const req = client.request(options, (res) => {
				let responseData = '';

				res.on('data', (chunk) => {
					responseData += chunk.toString();
				});

				res.on('end', () => {
					// Check if polling should stop before processing
					if (pollingState.shouldStop) {
						console.log('Polling stopped during response processing for channel:', resultChannel);
						return;
					}
					
					if (res.statusCode === 200) {
						try {
							const result = JSON.parse(responseData);
							console.log('Result:', result);
							
							if (result.printOutput && result.printOutput.length) {
								// Show only new output (delta)
								const newOutput = result.printOutput.slice(pollingState.lastPrintIndex);
								if (newOutput.length > 0 && !pollingState.shouldStop) {
									this.displayPrintOutput(newOutput);
									pollingState.lastPrintIndex = result.printOutput.length;
								}
							}
						} catch (error) {
							console.log('Parse error:', error);
						}
					}
					
					// Continue polling if not stopped
					if (!pollingState.shouldStop) {
						setTimeout(pollResult, 10);
					}
				});
			});

			req.on('error', (error) => {
				console.log('Result error', error);
				// Continue polling on error
				if (!pollingState.shouldStop) {
					setTimeout(pollResult, 1000);
				}
			});

			req.end();
		};

		// Start polling after a short delay
		setTimeout(pollResult, 0);
	}

	private displayExecutionResult(result: ExecutionResult): void {
		if (result.printOutput && result.printOutput.length > 0) {
			this.outputService.appendLine('');
			this.outputService.appendLine('📝 Script Output:');
			this.outputService.appendLine('─'.repeat(50));
			this.displayPrintOutput(result.printOutput);
		}
		
		if (result.scriptPerf) {
			this.outputService.appendLine(`⏱️  Script Performance: ${result.scriptPerf}ms`);
		}
		
		if (result.webscriptPerf) {
			this.outputService.appendLine(`🔧 Webscript Performance: ${result.webscriptPerf}ms`);
		}
		
		if (result.spacePath) {
			this.outputService.appendLine(`📁 Space Path: ${result.spacePath}`);
		}

		if (result.result && result.result.length > 0) {
			this.outputService.appendLine(`📋 Result: ${JSON.stringify(result.result, null, 2)}`);
		}

		if (result.error) {
			this.outputService.appendLine(`❌ Error: ${result.error}`);
		}
	}
}