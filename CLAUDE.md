# CLAUDE.md

## Project Overview

zentao-cli is a CLI tool for ZenTao (禅道) project management system. It wraps ZenTao's RESTful API v2, providing command-line access to products, projects, bugs, tasks, stories, test cases, and other modules. It is also AI-agent-friendly and can run as an MCP server.

For user-facing documentation see [README.md](./README.md) and [docs/](./docs/).

## Commands

```bash
bun run dev            # Run in dev mode
bun run build          # Build (minified) → dist/index.js
bun run build:sf       # Build standalone binary
bun test               # Run all tests
bun test tests/<file>  # Run a single test file
bun run update-registry  # Regenerate module registry from OpenAPI spec
```

## Architecture

### Core Abstraction: Module Registry

The entire CLI is driven by a **module registry** pattern — each ZenTao API endpoint is described as a `ModuleDefinition` (defined in `src/types/module.ts`).

- `src/modules/registry.ts` — **Auto-generated** from `data/zentao-openapi.json` by `scripts/update-registry.ts`. **Never edit manually.**
- `src/modules/registry-example.ts` — Reference pattern for module definitions.
- `src/modules/resolver.ts` — Resolves CLI argv into `ResolvedModuleCommand`.
- `src/modules/renders.ts` — Result rendering functions referenced by module definitions.
- `src/modules/helper.ts` — Help text generation from module definitions.

### Key Source Layout

```
src/
├── index.ts               # CLI entry (Commander)
├── errors.ts              # ZentaoError codes
├── commands/              # Subcommand registrations & handlers
│   ├── register-modules.ts  # Dynamic module→subcommand mapping
│   ├── module-handler.ts    # Execute resolved module commands
│   └── ...                  # login, config, mcp, crud, etc.
├── api/client.ts          # ZentaoClient (fetch wrapper, token, TLS, errors)
├── auth/                  # Login flow & credential prompting
├── config/                # Persistent config (configstore) & workspace state
├── mcp/                   # MCP server (tools + lifecycle)
├── types/                 # Shared TS types (module, api, commands, config)
└── utils/                 # Formatting, rendering, data processing, HTML→MD, etc.
```

## Testing

- **Framework**: Bun's built-in test runner (`bun test`).
- **Test files**: `tests/*.test.ts` — naming convention `<subject>.test.ts`.
- **Helpers**: `tests/helpers.ts`.
- **Integration tests**: Require `.env.test` with `ZENTAO_URL`, `ZENTAO_ACCOUNT`, `ZENTAO_PASSWORD`.

## Build & Distribution

- `bin/zentao.js` — npm global install entry shim → `dist/index.js`.
- Published to npm as `zentao-cli`; `files` includes `bin/`, `dist/`, `skills/`.

## Code Conventions

- **Runtime**: Bun (not Node.js). TypeScript, ESNext target, bundler module resolution.
- **Language**: Code and comments in English; user-facing CLI strings in Chinese (简体中文).
- **Error handling**: All domain errors use `ZentaoError` with structured codes from `src/errors.ts`. Never throw raw strings.
- **Imports**: Use `.js` extension in import paths (ESM): `import { foo } from './bar.js'`.
- **Module definitions**: Follow `ModuleDefinition` type. Use `registry-example.ts` as reference.
- **Commit messages**: First line uses `*`/`+`/`-` prefix, no emoji. `*` = change; `+` = addition; `-` = removal.
- **Config file env var**: `ZENTAO_CONFIG_FILE` — custom config file path (alternative to `--config` flag).
