import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Profile } from '../models/profile';

export class ConfigurationService {
	private static readonly CONFIG_SECTION = 'alfrescoJsConsole';
	private static readonly SECRET_KEY_PASSWORD = 'alfrescoPassword';
	private static readonly PROFILES_KEY = 'alfrescoProfiles';
	private static readonly ACTIVE_PROFILE_KEY = 'alfrescoActiveProfileId';
	private static readonly MIGRATED_KEY = 'alfrescoProfilesMigrated';

	private context?: vscode.ExtensionContext;

	private readonly _onActiveProfileChanged = new vscode.EventEmitter<Profile | undefined>();
	readonly onActiveProfileChanged = this._onActiveProfileChanged.event;

	async setContext(context: vscode.ExtensionContext): Promise<void> {
		this.context = context;
		await this.migrateIfNeeded();
	}

	// --- Profile CRUD ---

	getProfiles(): Profile[] {
		if (!this.context) { return []; }
		return this.context.globalState.get<Profile[]>(ConfigurationService.PROFILES_KEY, []);
	}

	getActiveProfile(): Profile | undefined {
		const profiles = this.getProfiles();
		if (profiles.length === 0) { return undefined; }
		const activeId = this.context?.globalState.get<string>(ConfigurationService.ACTIVE_PROFILE_KEY);
		return profiles.find(p => p.id === activeId) || undefined;
	}

	async setActiveProfile(profileId: string): Promise<void> {
		if (!this.context) { return; }
		await this.context.globalState.update(ConfigurationService.ACTIVE_PROFILE_KEY, profileId);
		this._onActiveProfileChanged.fire(this.getActiveProfile());
	}

	async addProfile(profile: Profile, password: string): Promise<void> {
		if (!this.context) { return; }
		const profiles = this.getProfiles();
		profiles.push(profile);
		await this.context.globalState.update(ConfigurationService.PROFILES_KEY, profiles);
		await this.context.secrets.store(`alfrescoPassword_${profile.id}`, password);

		// Auto-activate if first profile
		if (profiles.length === 1) {
			await this.setActiveProfile(profile.id);
		}
	}

	async updateProfile(profile: Profile, password?: string): Promise<void> {
		if (!this.context) { return; }
		const profiles = this.getProfiles();
		const index = profiles.findIndex(p => p.id === profile.id);
		if (index === -1) { return; }
		profiles[index] = profile;
		await this.context.globalState.update(ConfigurationService.PROFILES_KEY, profiles);
		if (password !== undefined) {
			await this.context.secrets.store(`alfrescoPassword_${profile.id}`, password);
		}
		// Fire event if this is the active profile
		const activeId = this.context.globalState.get<string>(ConfigurationService.ACTIVE_PROFILE_KEY);
		if (profile.id === activeId) {
			this._onActiveProfileChanged.fire(profile);
		}
	}

	async deleteProfile(profileId: string): Promise<void> {
		if (!this.context) { return; }
		let profiles = this.getProfiles();
		profiles = profiles.filter(p => p.id !== profileId);
		await this.context.globalState.update(ConfigurationService.PROFILES_KEY, profiles);
		await this.context.secrets.delete(`alfrescoPassword_${profileId}`);

		const activeId = this.context.globalState.get<string>(ConfigurationService.ACTIVE_PROFILE_KEY);
		if (activeId === profileId) {
			const newActiveId = profiles.length > 0 ? profiles[0].id : undefined;
			await this.context.globalState.update(ConfigurationService.ACTIVE_PROFILE_KEY, newActiveId);
			this._onActiveProfileChanged.fire(this.getActiveProfile());
		}
	}

	async getProfilePassword(profileId: string): Promise<string> {
		if (!this.context) { return ''; }
		return (await this.context.secrets.get(`alfrescoPassword_${profileId}`)) || '';
	}

	generateProfileId(): string {
		return crypto.randomBytes(8).toString('hex');
	}

	// --- Legacy-compatible getters (delegate to active profile, fall back to settings) ---

	getServerUrl(): string {
		const profile = this.getActiveProfile();
		if (profile) { return profile.serverUrl; }
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<string>('server.url', '');
	}

	getUsername(): string {
		const profile = this.getActiveProfile();
		if (profile) { return profile.username; }
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<string>('server.username', '');
	}

	async getPassword(): Promise<string> {
		if (!this.context) { return ''; }
		const profile = this.getActiveProfile();
		if (profile) {
			return this.getProfilePassword(profile.id);
		}
		return (await this.context.secrets.get(ConfigurationService.SECRET_KEY_PASSWORD)) || '';
	}

	getConsoleVariant(): 'auto' | 'ootbee' | 'fme' {
		const profile = this.getActiveProfile();
		if (profile) { return profile.consoleVariant; }
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<'auto' | 'ootbee' | 'fme'>('server.consoleVariant', 'auto');
	}

	getDefaultTransaction(): 'readonly' | 'readwrite' {
		const profile = this.getActiveProfile();
		if (profile) { return profile.defaultTransaction; }
		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		return config.get<'readonly' | 'readwrite'>('execution.defaultTransaction', 'readonly');
	}

	getDefaultRunAs(): string {
		const profile = this.getActiveProfile();
		if (profile) { return profile.defaultRunAs; }
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

	// --- Migration ---

	private async migrateIfNeeded(): Promise<void> {
		if (!this.context) { return; }
		if (this.context.globalState.get<boolean>(ConfigurationService.MIGRATED_KEY)) { return; }

		const config = vscode.workspace.getConfiguration(ConfigurationService.CONFIG_SECTION);
		const url = config.get<string>('server.url', '');
		const username = config.get<string>('server.username', '');
		const password = (await this.context.secrets.get(ConfigurationService.SECRET_KEY_PASSWORD)) || '';

		if (url && username) {
			const profile: Profile = {
				id: this.generateProfileId(),
				name: 'Default',
				serverUrl: url,
				username,
				consoleVariant: config.get<'auto' | 'ootbee' | 'fme'>('server.consoleVariant', 'auto'),
				defaultTransaction: config.get<'readonly' | 'readwrite'>('execution.defaultTransaction', 'readonly'),
				defaultRunAs: config.get<string>('execution.defaultRunAs', ''),
			};
			await this.addProfile(profile, password);
		}

		await this.context.globalState.update(ConfigurationService.MIGRATED_KEY, true);
	}
}
