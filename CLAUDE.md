# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

zentao-cli is a CLI tool for ZenTao (禅道) project management system. It wraps ZenTao's RESTful API v2, providing command-line access to products, projects, bugs, tasks, stories, test cases, and other modules. It is also AI-agent-friendly and can run as an MCP server.

## Commands

```bash
# Run in dev mode
bun run dev

# Build (minified)
bun run build

# Build standalone binary
bun run build:sf

# Run all tests
bun test

# Run a single test file
bun test tests/api.test.ts

# Update module registry from OpenAPI spec
bun run update-registry
```

## CLI Subcommands

```
zentao login / logout / profile       # 认证与 Profile 管理
zentao config                         # 配置管理
zentao workspace                      # 工作区管理（最近使用的产品/项目/执行）
zentao <module> [action] [args...]    # 模块操作（动态注册，支持所有禅道 API 模块）
zentao get/list/create/update/delete  # CRUD 快捷命令
zentao mcp                            # 启动 MCP Server
zentao add-skill / add-mcp            # 安装 AI Skill / MCP 配置到 IDE
zentao upgrade                        # 升级 CLI
zentao autocomplete                   # Shell 自动补全
zentao version                        # 版本信息
zentao help <module>                  # 模块帮助
```

Global options: `--format <markdown|json|raw>`, `--silent`, `--insecure`, `--timeout <ms>`, `--config <config_file>`, `--machine-readable`.

## Architecture

### Entry Point & CLI Framework

`src/index.ts` — CLI entry. Uses **Commander** to register global options and delegates to subcommand registrations via `src/commands/index.ts`.

### Module System (core abstraction)

The entire CLI is driven by a **module registry** pattern:

- `src/modules/registry.ts` — **Auto-generated** from `data/zentao-openapi.json` by `scripts/update-registry.ts`. **Never edit manually.**
- `src/modules/registry-example.ts` — Reference pattern for module definitions. Use this as the template when adding new modules.
- `src/types/module.ts` — `ModuleDefinition` and `ModuleAction` types that define the shape of every module.
- `src/modules/resolver.ts` — Resolves CLI argv into `ResolvedModuleCommand` (path, query, body, scope inference).
- `src/modules/renders.ts` — Result rendering functions referenced by name in module definitions.
- `src/modules/helper.ts` — Help text generation from module definitions.

Each `ModuleDefinition` declares a module name, display info, and an array of `ModuleAction`s. Each action specifies: HTTP method, API path template (with `{param}` placeholders), parameters, request body schema, result/pager getters, and render functions.

### Command Registration

- `src/commands/register-modules.ts` — Dynamically registers `zentao <module> [action] [args...]` subcommands from the module registry. Supports CRUD aliases (`ls`→`list`, positional IDs for `get`) and scope resolution (`--product`, `--project`, `--execution`).
- `src/commands/module-handler.ts` — Executes resolved module commands: authenticates, calls API, extracts results, applies data processing (pick/filter/sort/search/pagination), and renders output.
- `src/commands/crud.ts` — Registers top-level `zentao get/list/create/update/delete` shortcuts.
- `src/commands/help.ts` — `zentao help <module>` subcommand.
- `src/commands/login.ts` / `logout.ts` / `profile.ts` — Authentication lifecycle commands.
- `src/commands/config.ts` / `workspace.ts` — Configuration and workspace state management commands.
- `src/commands/version.ts` / `upgrade.ts` — Version display and CLI self-upgrade.
- `src/commands/autocomplete.ts` — Shell completion script generation.
- `src/commands/add-skill.ts` / `add-mcp.ts` — AI integration installation commands.
- `src/commands/mcp.ts` — MCP Server launch command.

### API Client

`src/api/client.ts` — `ZentaoClient` class wrapping `fetch` against ZenTao's `/api.php/v2` endpoint. Handles token injection, TLS bypass, timeout, and error mapping to `ZentaoError` codes.

### Auth & Config

- `src/auth/` — Login flow (`login.ts`), credential prompting (`prompt.ts`), auth orchestration (`flow.ts`).
- `src/config/store.ts` — Persistent config via `configstore` (supports `--config` flag and `ZENTAO_CONFIG_FILE` env var).
- `src/config/workspace.ts` — Workspace state (last-used product/project/execution).
- `src/config/defaults.ts` — Default configuration values.

### Utilities

`src/utils/` — Shared infrastructure used across the codebase:

- `update-notifier.ts` — Background version update check (non-blocking, with abort support).
- `version.ts` — CLI version retrieval from `package.json`.
- `format.ts` — Data formatting (table, list, key-value rendering).
- `render.ts` — Terminal output rendering with color and styling.
- `data.ts` — Data processing: pick fields, filter, sort, search, pagination.
- `html.ts` — HTML-to-Markdown conversion (via `turndown`).
- `env.ts` — Environment variable utilities.
- `stdin.ts` — Stdin reading for piped input.

### Type Definitions

`src/types/` — Shared TypeScript type definitions:

- `module.ts` — `ModuleDefinition`, `ModuleAction`, and related types for the module system.
- `api.ts` — API response and request types.
- `commands.ts` — Command-related types (resolved commands, handler options).
- `config.ts` — Configuration and profile types.

### MCP Server

`src/mcp/` — Model Context Protocol server exposing ZenTao operations as MCP tools. Run with `zentao mcp`.

- `server.ts` — MCP server setup and lifecycle.
- `tools.ts` — Tool definitions mapping module actions to MCP tools.

### Skills

`skills/` — AI agent skill definitions (for Claude Code, Cursor, etc.) installed via `zentao add-skill`.

## Testing

- **Framework**: Bun's built-in test runner (`bun test`).
- **Test files**: `tests/*.test.ts` — naming convention follows `<subject>.test.ts`.
- **Test helpers**: `tests/helpers.ts` — shared utilities for test setup.
- **Integration tests**: Require `.env.test` with real ZenTao server credentials (`ZENTAO_URL`, `ZENTAO_ACCOUNT`, `ZENTAO_PASSWORD`).
- **Run a single test**: `bun test tests/<file>.test.ts`.

## Build & Distribution

- `bun run build` — Bundles to `dist/index.js` (minified).
- `bun run build:sf` — Compiles to standalone binary.
- `bin/zentao.js` — npm global install entry shim, invokes `dist/index.js`.
- Published to npm as `zentao-cli`; `files` includes `bin/`, `dist/`, `skills/`.

## Key Dependencies

- **commander** — CLI framework (argument parsing, subcommands, help generation).
- **configstore** — Persistent JSON config storage.
- **@modelcontextprotocol/sdk** — MCP server implementation.
- **turndown** — HTML→Markdown conversion for ZenTao rich-text fields.
- **zod** — Runtime schema validation.
- **dot-prop** — Deep property access for config operations.

## Environment Variables

- `ZENTAO_CONFIG_FILE` — Custom config file path (alternative to `--config` flag).

## Code Conventions

- **Runtime**: Bun (not Node.js). TypeScript with ESNext target, bundler module resolution.
- **Indentation**: 4 spaces.
- **Language**: Code and comments in English; user-facing CLI strings in Chinese (简体中文).
- **Error handling**: All domain errors use `ZentaoError` with structured error codes from `src/errors.ts`. Never throw raw strings.
- **Imports**: Use `.js` extension in import paths (ESM requirement): `import { foo } from './bar.js'`.
- **Module definitions**: Follow `ModuleDefinition` type from `src/types/module.ts`. Use `registry-example.ts` as the reference.
- **Commit message format**: first line must use */+/- prefix, no emoji, `*` = changes to existing functionality; `+` = new features or modules; `-` = removal of existing features/modules.
