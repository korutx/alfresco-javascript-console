#!/usr/bin/env node

import * as fs from 'fs';
import { AlfrescoApiService } from '../services/alfrescoApiService';
import { CliOutputService } from './cliOutputService';
import { CliConfigurationService } from './cliConfigurationService';
import { ExecutionResult } from '../shared/interfaces';

// --- Arg parsing ---

interface ParsedArgs {
	command: string;
	subcommand: string;
	positional: string[];
	flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2);
	const result: ParsedArgs = { command: '', subcommand: '', positional: [], flags: {} };

	let i = 0;
	// Collect command and subcommand
	while (i < args.length && !args[i].startsWith('--')) {
		if (!result.command) { result.command = args[i]; }
		else if (!result.subcommand) { result.subcommand = args[i]; }
		else { result.positional.push(args[i]); }
		i++;
	}
	// Collect flags
	while (i < args.length) {
		const arg = args[i];
		if (arg.startsWith('--')) {
			const key = arg.slice(2);
			const next = args[i + 1];
			if (next && !next.startsWith('--')) {
				result.flags[key] = next;
				i += 2;
			} else {
				result.flags[key] = true;
				i++;
			}
		} else {
			result.positional.push(arg);
			i++;
		}
	}
	return result;
}

function flag(flags: Record<string, string | boolean>, key: string): string | undefined {
	const v = flags[key];
	return typeof v === 'string' ? v : undefined;
}

// --- Help ---

function printHelp(): void {
	const pkg = loadPackageJson();
	process.stdout.write(`alfresco-js-console v${pkg.version}

Usage:
  alfresco-js-console run <file>               Execute a script file
  alfresco-js-console run -                     Read script from stdin
  alfresco-js-console run                       Read from stdin (piped)
  alfresco-js-console profile list              List saved profiles
  alfresco-js-console profile add               Add a new profile
  alfresco-js-console profile switch <name>     Switch active profile
  alfresco-js-console profile delete <name>     Delete a profile

Global flags:
  --json                        Structured JSON output
  --profile <name>              Use specific profile for this command
  --server <url>                Inline server URL (bypasses profiles)
  --username <user>             Inline username
  --password <pass>             Inline password
  --variant <auto|ootbee|fme>   Console variant override
  --transaction <ro|rw>         Transaction type (readonly|readwrite)
  --runas <user>                Run-as user override
  --help                        Show this help
  --version                     Show version
`);
}

function loadPackageJson(): { version: string } {
	try {
		// Try from dist/cli (compiled location)
		const distPath = require('path').resolve(__dirname, '../../package.json');
		return JSON.parse(fs.readFileSync(distPath, 'utf-8'));
	} catch {
		return { version: 'unknown' };
	}
}

// --- Stdin reading ---

function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = '';
		process.stdin.setEncoding('utf-8');
		process.stdin.on('data', (chunk) => { data += chunk; });
		process.stdin.on('end', () => resolve(data));
		process.stdin.on('error', reject);
	});
}

// --- Commands ---

async function runCommand(parsed: ParsedArgs): Promise<void> {
	const jsonMode = parsed.flags['json'] === true;
	const outputService = new CliOutputService(jsonMode);
	const configService = new CliConfigurationService({
		server: flag(parsed.flags, 'server'),
		username: flag(parsed.flags, 'username'),
		password: flag(parsed.flags, 'password'),
		variant: flag(parsed.flags, 'variant') as any,
		transaction: flag(parsed.flags, 'transaction') as any,
		runas: flag(parsed.flags, 'runas'),
		profile: flag(parsed.flags, 'profile'),
	});

	// Determine script source
	let script: string;
	const fileArg = parsed.subcommand;

	if (fileArg === '-' || (!fileArg && !process.stdin.isTTY)) {
		// Read from stdin
		script = await readStdin();
	} else if (fileArg && fileArg !== '-') {
		// Read from file
		try {
			script = fs.readFileSync(fileArg, 'utf-8');
		} catch (err) {
			const msg = `Error: Cannot read file '${fileArg}': ${err instanceof Error ? err.message : String(err)}`;
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(2);
		}
	} else {
		const msg = 'Error: No script provided. Specify a file or pipe via stdin.';
		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
		} else {
			process.stderr.write(msg + '\n');
		}
		process.exit(2);
	}

	if (!script.trim()) {
		const msg = 'Error: Script is empty.';
		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
		} else {
			process.stderr.write(msg + '\n');
		}
		process.exit(2);
	}

	// Validate configuration
	const serverUrl = configService.getServerUrl();
	const username = configService.getUsername();
	const password = await configService.getPassword();
	if (!serverUrl || !username || !password) {
		const msg = 'Error: Server configuration missing. Use --server/--username/--password or configure a profile.';
		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
		} else {
			process.stderr.write(msg + '\n');
		}
		process.exit(2);
	}

	const apiService = new AlfrescoApiService(outputService, configService);

	const transactionFlag = flag(parsed.flags, 'transaction');
	let transaction: 'readonly' | 'readwrite' | undefined;
	if (transactionFlag === 'readonly' || transactionFlag === 'readwrite') {
		transaction = transactionFlag;
	}

	const result = await apiService.executeScript(script, {
		transaction,
		runas: flag(parsed.flags, 'runas'),
	});

	if (jsonMode) {
		const output: Record<string, any> = {
			success: !result?.error,
			printOutput: result?.printOutput ?? [],
			result: result?.result ?? [],
			scriptPerf: result?.scriptPerf ?? null,
			webscriptPerf: result?.webscriptPerf ?? null,
			spacePath: result?.spacePath ?? null,
			error: result?.error ?? null,
		};
		process.stdout.write(JSON.stringify(output) + '\n');
	}

	if (result?.error) {
		process.exit(1);
	}
}

function profileCommand(parsed: ParsedArgs): void {
	const jsonMode = parsed.flags['json'] === true;
	const configService = new CliConfigurationService({
		profile: flag(parsed.flags, 'profile'),
	});

	const sub = parsed.subcommand;

	if (sub === 'list') {
		const profiles = configService.listProfiles();
		if (jsonMode) {
			process.stdout.write(JSON.stringify(profiles) + '\n');
		} else {
			if (profiles.length === 0) {
				process.stdout.write('No profiles configured.\n');
			} else {
				for (const p of profiles) {
					const marker = p.active ? '* ' : '  ';
					process.stdout.write(`${marker}${p.name} — ${p.serverUrl} (${p.username})\n`);
				}
			}
		}
		return;
	}

	if (sub === 'add') {
		const name = flag(parsed.flags, 'name');
		const server = flag(parsed.flags, 'server');
		const username = flag(parsed.flags, 'username');
		const password = flag(parsed.flags, 'password');

		if (!name || !server || !username || !password) {
			const msg = 'Error: --name, --server, --username, and --password are required.';
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(2);
		}

		configService.addProfile(name, server, username, password, {
			variant: flag(parsed.flags, 'variant') as any,
			transaction: flag(parsed.flags, 'transaction') as any,
			runas: flag(parsed.flags, 'runas'),
		});

		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: true }) + '\n');
		} else {
			process.stdout.write(`Profile '${name}' added.\n`);
		}
		return;
	}

	if (sub === 'switch') {
		const name = parsed.positional[0] || flag(parsed.flags, 'name');
		if (!name) {
			const msg = 'Error: Profile name required.';
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(2);
		}
		const ok = configService.switchProfile(name);
		if (!ok) {
			const msg = `Error: Profile '${name}' not found.`;
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(1);
		}
		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: true }) + '\n');
		} else {
			process.stdout.write(`Switched to profile '${name}'.\n`);
		}
		return;
	}

	if (sub === 'delete') {
		const name = parsed.positional[0] || flag(parsed.flags, 'name');
		if (!name) {
			const msg = 'Error: Profile name required.';
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(2);
		}
		const ok = configService.deleteProfile(name);
		if (!ok) {
			const msg = `Error: Profile '${name}' not found.`;
			if (jsonMode) {
				process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
			} else {
				process.stderr.write(msg + '\n');
			}
			process.exit(1);
		}
		if (jsonMode) {
			process.stdout.write(JSON.stringify({ success: true }) + '\n');
		} else {
			process.stdout.write(`Profile '${name}' deleted.\n`);
		}
		return;
	}

	// Unknown subcommand or no subcommand
	const msg = 'Error: Unknown profile command. Use: list, add, switch, delete';
	if (jsonMode) {
		process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
	} else {
		process.stderr.write(msg + '\n');
	}
	process.exit(2);
}

// --- Main ---

async function main(): Promise<void> {
	const parsed = parseArgs(process.argv);

	if (parsed.flags['help'] === true || (!parsed.command && process.stdin.isTTY)) {
		printHelp();
		return;
	}

	if (parsed.flags['version'] === true) {
		const pkg = loadPackageJson();
		process.stdout.write(pkg.version + '\n');
		return;
	}

	if (parsed.command === 'run') {
		await runCommand(parsed);
		return;
	}

	if (parsed.command === 'profile') {
		profileCommand(parsed);
		return;
	}

	// No command — check if stdin is piped (implicit run)
	if (!parsed.command && !process.stdin.isTTY) {
		parsed.command = 'run';
		await runCommand(parsed);
		return;
	}

	process.stderr.write(`Error: Unknown command '${parsed.command}'. Use --help for usage.\n`);
	process.exit(2);
}

main().catch((err) => {
	process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
	process.exit(1);
});
