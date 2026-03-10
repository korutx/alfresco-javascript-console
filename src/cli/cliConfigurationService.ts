import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { IConfigurationService } from '../shared/interfaces';
import { Profile } from '../models/profile';

interface ConfigFile {
	profiles: (Profile & { password: string })[];
	activeProfileId?: string;
}

interface InlineOptions {
	server?: string;
	username?: string;
	password?: string;
	variant?: 'auto' | 'ootbee' | 'fme';
	transaction?: 'readonly' | 'readwrite';
	runas?: string;
	profile?: string;
}

export class CliConfigurationService implements IConfigurationService {
	private static readonly CONFIG_DIR = path.join(os.homedir(), '.alfresco-js-console');
	private static readonly CONFIG_FILE = path.join(CliConfigurationService.CONFIG_DIR, 'config.json');

	private inlineOptions: InlineOptions;
	private config: ConfigFile | null = null;

	constructor(options: InlineOptions) {
		this.inlineOptions = options;
	}

	private isInlineMode(): boolean {
		return !!this.inlineOptions.server;
	}

	private loadConfig(): ConfigFile {
		if (this.config) { return this.config; }
		try {
			const data = fs.readFileSync(CliConfigurationService.CONFIG_FILE, 'utf-8');
			this.config = JSON.parse(data) as ConfigFile;
		} catch {
			this.config = { profiles: [] };
		}
		return this.config;
	}

	private saveConfig(config: ConfigFile): void {
		if (!fs.existsSync(CliConfigurationService.CONFIG_DIR)) {
			fs.mkdirSync(CliConfigurationService.CONFIG_DIR, { recursive: true, mode: 0o700 });
		}
		fs.writeFileSync(CliConfigurationService.CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
		this.config = config;
	}

	private resolveProfile(): (Profile & { password: string }) | undefined {
		const config = this.loadConfig();
		if (this.inlineOptions.profile) {
			return config.profiles.find(p => p.name === this.inlineOptions.profile);
		}
		if (config.activeProfileId) {
			return config.profiles.find(p => p.id === config.activeProfileId);
		}
		return config.profiles[0];
	}

	// --- IConfigurationService ---

	getServerUrl(): string {
		if (this.isInlineMode()) { return this.inlineOptions.server!; }
		return this.resolveProfile()?.serverUrl ?? '';
	}

	getUsername(): string {
		if (this.isInlineMode()) { return this.inlineOptions.username ?? ''; }
		return this.resolveProfile()?.username ?? '';
	}

	async getPassword(): Promise<string> {
		if (this.isInlineMode()) { return this.inlineOptions.password ?? ''; }
		return this.resolveProfile()?.password ?? '';
	}

	getConsoleVariant(): 'auto' | 'ootbee' | 'fme' {
		if (this.inlineOptions.variant) { return this.inlineOptions.variant; }
		return this.resolveProfile()?.consoleVariant ?? 'auto';
	}

	getDefaultTransaction(): 'readonly' | 'readwrite' {
		if (this.inlineOptions.transaction) { return this.inlineOptions.transaction; }
		return this.resolveProfile()?.defaultTransaction ?? 'readonly';
	}

	getDefaultRunAs(): string {
		if (this.inlineOptions.runas) { return this.inlineOptions.runas; }
		return this.resolveProfile()?.defaultRunAs ?? '';
	}

	getActiveProfile(): Profile | undefined {
		if (this.isInlineMode()) { return undefined; }
		return this.resolveProfile();
	}

	// --- Profile management (CLI-only) ---

	listProfiles(): { name: string; serverUrl: string; username: string; active: boolean }[] {
		const config = this.loadConfig();
		return config.profiles.map(p => ({
			name: p.name,
			serverUrl: p.serverUrl,
			username: p.username,
			active: p.id === config.activeProfileId,
		}));
	}

	addProfile(name: string, serverUrl: string, username: string, password: string, options?: {
		variant?: 'auto' | 'ootbee' | 'fme';
		transaction?: 'readonly' | 'readwrite';
		runas?: string;
	}): void {
		const config = this.loadConfig();
		const profile: Profile & { password: string } = {
			id: crypto.randomBytes(8).toString('hex'),
			name,
			serverUrl,
			username,
			password,
			consoleVariant: options?.variant ?? 'auto',
			defaultTransaction: options?.transaction ?? 'readonly',
			defaultRunAs: options?.runas ?? '',
		};
		config.profiles.push(profile);
		if (config.profiles.length === 1) {
			config.activeProfileId = profile.id;
		}
		this.saveConfig(config);
	}

	switchProfile(name: string): boolean {
		const config = this.loadConfig();
		const profile = config.profiles.find(p => p.name === name);
		if (!profile) { return false; }
		config.activeProfileId = profile.id;
		this.saveConfig(config);
		return true;
	}

	deleteProfile(name: string): boolean {
		const config = this.loadConfig();
		const index = config.profiles.findIndex(p => p.name === name);
		if (index === -1) { return false; }
		const profileId = config.profiles[index].id;
		config.profiles.splice(index, 1);
		if (config.activeProfileId === profileId) {
			config.activeProfileId = config.profiles.length > 0 ? config.profiles[0].id : undefined;
		}
		this.saveConfig(config);
		return true;
	}
}
