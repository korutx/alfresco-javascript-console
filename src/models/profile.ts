export interface Profile {
	id: string;
	name: string;
	serverUrl: string;
	username: string;
	consoleVariant: 'auto' | 'ootbee' | 'fme';
	defaultTransaction: 'readonly' | 'readwrite';
	defaultRunAs: string;
}
