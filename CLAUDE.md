# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

VS Code extension + CLI tool for running JavaScript scripts against an Alfresco repository via the JavaScript Console webscript (OOTBee or fme variant). Single repo, two build targets.

## Build Commands

```bash
npm run compile          # Build VS Code extension → out/
npm run compile:cli      # Build CLI → dist/
npm run build            # Both
npm run watch            # Watch mode (extension only)
npm run lint             # ESLint
npm run test             # VS Code test runner (vscode-test)
```

Type-check without emitting:
```bash
npx tsc -p ./ --noEmit              # Extension
npx tsc -p ./tsconfig.cli.json --noEmit  # CLI
```

## Architecture

**Two build targets, shared core:**
- `tsconfig.json` → `out/` (VS Code extension). Excludes `src/cli/`.
- `tsconfig.cli.json` → `dist/` (CLI). Includes only `src/shared/`, `src/cli/`, `src/models/`, and `src/services/alfrescoApiService.ts`.

**Interface-based decoupling** (`src/shared/interfaces.ts`):
- `IOutputService` and `IConfigurationService` abstract away VS Code APIs.
- `AlfrescoApiService` depends only on these interfaces — works in both extension and CLI contexts.
- The VS Code `OutputService` and `ConfigurationService` implement them; the CLI has `CliOutputService` and `CliConfigurationService`.

**Key services:**
- `AlfrescoApiService` — HTTP(S) calls to Alfresco, variant auto-detection with caching, script execution with result polling. Returns `ExecutionResult`.
- `ConfigurationService` (VS Code) — profiles stored in globalState, passwords in VS Code secrets API, legacy settings migration.
- `CliConfigurationService` — profiles in `~/.alfresco-js-console/config.json` (0600 perms), or inline via `--server`/`--username`/`--password` flags.

**CLI entry point** (`src/cli/index.ts`):
- Zero runtime dependencies. Hand-rolled argv parsing.
- Commands: `run <file>` (supports stdin), `profile list|add|switch|delete`.
- `--json` flag for structured AI-friendly output. Exit codes: 0=success, 1=execution error, 2=config/usage error.

**Extension entry point** (`src/extension.ts`):
- Activates on `onLanguage:javascript`. Registers 7 commands.
- `WebviewPanelProvider` renders the side panel for script execution parameters.
- `StatusBarProvider` shows active profile.

## Lint Rules

ESLint with TypeScript parser. Key enforced rules: semicolons required, strict equality (`===`), curly braces required, camelCase/PascalCase imports.
