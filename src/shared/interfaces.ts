import { Profile } from '../models/profile';

export interface IOutputService {
	appendLine(message: string): void;
	append(message: string): void;
	clear(): void;
}

export interface IConfigurationService {
	getServerUrl(): string;
	getUsername(): string;
	getPassword(): Promise<string>;
	getConsoleVariant(): 'auto' | 'ootbee' | 'fme';
	getDefaultTransaction(): 'readonly' | 'readwrite';
	getDefaultRunAs(): string;
	getActiveProfile(): Profile | undefined;
}

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
