import { IOutputService } from '../shared/interfaces';

export class CliOutputService implements IOutputService {
	private buffer: string[] = [];
	private jsonMode: boolean;

	constructor(jsonMode: boolean) {
		this.jsonMode = jsonMode;
	}

	appendLine(message: string): void {
		if (this.jsonMode) {
			this.buffer.push(message);
		} else {
			process.stdout.write(message + '\n');
		}
	}

	append(message: string): void {
		if (this.jsonMode) {
			this.buffer.push(message);
		} else {
			process.stdout.write(message);
		}
	}

	clear(): void {
		this.buffer = [];
	}

	getBuffer(): string[] {
		return this.buffer;
	}
}
