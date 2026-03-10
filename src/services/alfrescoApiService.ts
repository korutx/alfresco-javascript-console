import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { IOutputService, IConfigurationService, ScriptExecutionParams, ExecutionResult } from '../shared/interfaces';

export { ScriptExecutionParams, ExecutionResult } from '../shared/interfaces';

type ConsoleVariant = 'ootbee' | 'fme';

export class AlfrescoApiService {
	private resultChannels = new Map<string, string>();
	private pollingStates = new Map<string, { shouldStop: boolean; lastPrintIndex: number }>();
	private detectedVariants = new Map<string, ConsoleVariant>();

	constructor(
		private outputService: IOutputService,
		private configurationService: IConfigurationService
	) {}

	/**
	 * Build the console base path (everything between serverUrl and /execute or /{id}/executionResult).
	 * Detects Share proxy URLs and omits the /s/ webscript servlet prefix accordingly.
	 */
	private getConsolePath(serverUrl: string, variant: ConsoleVariant): string {
		const isShareProxy = serverUrl.includes('/share/proxy/alfresco');
		const prefix = isShareProxy ? '' : '/s';
		const variantPath = variant === 'ootbee' ? 'ootbee' : 'de/fme';
		return `${prefix}/${variantPath}/jsconsole`;
	}

	/**
	 * Clear cached variant detection results.
	 * If profileId is provided, clears only that profile's cache; otherwise clears all.
	 */
	clearVariantCache(profileId?: string): void {
		if (profileId) {
			this.detectedVariants.delete(profileId);
		} else {
			this.detectedVariants.clear();
		}
	}

	/**
	 * Resolve which console variant to use. If configured as "auto", probe the server.
	 * Results are cached per profile ID (or per serverUrl for legacy config).
	 */
	private async resolveVariant(serverUrl: string, username: string, password: string): Promise<ConsoleVariant> {
		const configured = this.configurationService.getConsoleVariant();
		if (configured !== 'auto') {
			return configured;
		}

		const activeProfile = this.configurationService.getActiveProfile();
		const cacheKey = activeProfile?.id ?? serverUrl;

		// Return cached detection
		const cached = this.detectedVariants.get(cacheKey);
		if (cached) {
			return cached;
		}

		// Probe OOTBee first (actively maintained), then fall back to fme
		this.outputService.appendLine('Auto-detecting console variant...');
		for (const variant of ['ootbee', 'fme'] as ConsoleVariant[]) {
			const ok = await this.probeVariant(serverUrl, username, password, variant);
			if (ok) {
				this.detectedVariants.set(cacheKey, variant);
				this.outputService.appendLine(`Detected console variant: ${variant}`);
				return variant;
			}
		}

		// Default to ootbee if neither responded
		this.outputService.appendLine('Could not auto-detect variant, defaulting to ootbee');
		this.detectedVariants.set(cacheKey, 'ootbee');
		return 'ootbee';
	}

	/**
	 * Probe a console variant by sending a lightweight request to its execute endpoint.
	 * Returns true if the server responds (even with an error like 400), false on connection/404 errors.
	 */
	private probeVariant(serverUrl: string, username: string, password: string, variant: ConsoleVariant): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const consolePath = this.getConsolePath(serverUrl, variant);
			const url = new URL(`${serverUrl}${consolePath}/execute`);
			const isHttps = url.protocol === 'https:';

			const options = {
				hostname: url.hostname,
				port: url.port || (isHttps ? 443 : 80),
				path: url.pathname,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Content-Length': 2,
					'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
				},
				rejectUnauthorized: false,
				timeout: 5000
			};

			const client = isHttps ? https : http;
			const req = client.request(options, (res) => {
				// Consume response data to free the socket
				res.on('data', () => {});
				res.on('end', () => {
					// Any response except 404 means the endpoint exists
					resolve(res.statusCode !== 404);
				});
			});

			req.on('error', () => resolve(false));
			req.on('timeout', () => { req.destroy(); resolve(false); });
			req.write('{}');
			req.end();
		});
	}

	async executeScript(script: string, params?: Partial<ScriptExecutionParams>): Promise<ExecutionResult | undefined> {
		const serverUrl = this.configurationService.getServerUrl();
		const username = this.configurationService.getUsername();
		const password = await this.configurationService.getPassword();

		if (!serverUrl || !username || !password) {
			this.outputService.appendLine('Error: Server configuration missing');
			return undefined;
		}

		const variant = await this.resolveVariant(serverUrl, username, password);
		const consolePath = this.getConsolePath(serverUrl, variant);

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
		this.fetchExecutionResult(serverUrl, username, password, resultChannel, consolePath);

		let result: ExecutionResult | undefined;
		try {
			result = await this.executeScriptRequest(serverUrl, username, password, executionParams, resultChannel, consolePath);
		} catch (error) {
			this.outputService.appendLine(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
			result = { error: error instanceof Error ? error.message : String(error) };
		} finally {
			// Stop polling when script execution completes (success or error)
			const pollingState = this.pollingStates.get(resultChannel);
			if (pollingState) {
				pollingState.shouldStop = true;
			}
		}
		return result;
	}

	private async executeScriptRequest(
		serverUrl: string,
		username: string,
		password: string,
		params: ScriptExecutionParams,
		resultChannel: string,
		consolePath: string
	): Promise<ExecutionResult | undefined> {
		return new Promise<ExecutionResult | undefined>((resolve, reject) => {
			const url = new URL(`${serverUrl}${consolePath}/execute`);
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
							const result = JSON.parse(responseData) as ExecutionResult;
							// Display the final complete response
							this.displayFinalExecutionResult(result, resultChannel);
							resolve(result);
						} catch (error) {
							this.outputService.appendLine('✅ Script execution completed (response parsing failed)');
							resolve(undefined);
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

		if (result.renderedTemplate) {
			this.outputService.appendLine(`📄 Template Output:`);
			this.outputService.appendLine(result.renderedTemplate);
		}

		if (result.error) {
			this.outputService.appendLine(`❌ Error: ${result.error}`);
		}
	}

	private fetchExecutionResult(
		serverUrl: string,
		username: string,
		password: string,
		resultChannel: string,
		consolePath: string
	): void {
		const pollResult = () => {
			const pollingState = this.pollingStates.get(resultChannel);
			if (!pollingState || pollingState.shouldStop) {
				this.pollingStates.delete(resultChannel);
				return;
			}

			const url = new URL(`${serverUrl}${consolePath}/${resultChannel}/executionResult`);
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
						return;
					}
					
					if (res.statusCode === 200) {
						try {
							const result = JSON.parse(responseData);

							if (result.printOutput && result.printOutput.length) {
								// Show only new output (delta)
								const newOutput = result.printOutput.slice(pollingState.lastPrintIndex);
								if (newOutput.length > 0 && !pollingState.shouldStop) {
									this.displayPrintOutput(newOutput);
									pollingState.lastPrintIndex = result.printOutput.length;
								}
							}
						} catch {
							// Ignore parse errors during polling
						}
					}
					
					// Continue polling if not stopped
					if (!pollingState.shouldStop) {
						setTimeout(pollResult, 10);
					}
				});
			});

			req.on('error', () => {
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