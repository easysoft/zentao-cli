import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { Command } from 'commander';
import { getModuleActionParams } from 'zentao-api';
import { addDataOptions } from '../src/commands/register-modules';
import { getAction } from '../src/modules/helper';
import { getModule } from '../src/modules';
import type { ModuleAction, ModuleDefinition } from '../src/types';
import { runCliWithoutAuth } from './helpers';

interface SkillCommand {
    file: string;
    line: number;
    raw: string;
    fenced: boolean;
}

const SKILLS_DIR = join(process.cwd(), 'skills');
const BUILTIN_COMMANDS = new Set([
    'login', 'logout', 'profile', 'config', 'workspace', 'version', 'help',
    'ls', 'list', 'get', 'create', 'update', 'delete', 'do', 'autocomplete',
    'mcp', 'add-mcp', 'add-skill',
]);

function markdownFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return markdownFiles(path);
        return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
    });
}

function stripShellComment(line: string): string {
    let quote = '';
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if ((char === '"' || char === "'") && line[i - 1] !== '\\') {
            quote = quote === char ? '' : (quote || char);
        } else if (char === '#' && quote === '' && (i === 0 || /\s/.test(line[i - 1]))) {
            return line.slice(0, i).trim();
        }
    }
    return line.trim();
}

function extractSkillCommands(): SkillCommand[] {
    const commands: SkillCommand[] = [];
    const seen = new Set<string>();

    for (const file of markdownFiles(SKILLS_DIR)) {
        const content = readFileSync(file, 'utf8');
        const lines = content.split(/\r?\n/);
        let shellFence = false;

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const fence = line.trim().match(/^```([^\s`]*)/);
            if (fence) {
                if (shellFence) shellFence = false;
                else shellFence = /^(?:ba|z)?sh$|^shell$/.test(fence[1]);
                continue;
            }

            const candidates: Array<{ raw: string; fenced: boolean }> = [];
            if (shellFence && line.trim().startsWith('zentao ')) {
                candidates.push({ raw: stripShellComment(line.trim()), fenced: true });
            }
            for (const match of line.matchAll(/`(zentao(?:\s+[^`]+)?)`/g)) {
                candidates.push({ raw: match[1].trim(), fenced: false });
            }

            for (const candidate of candidates) {
                const key = `${file}:${index + 1}:${candidate.raw}`;
                if (seen.has(key)) continue;
                seen.add(key);
                commands.push({
                    file: relative(process.cwd(), file),
                    line: index + 1,
                    ...candidate,
                });
            }
        }
    }
    return commands;
}

function shellWords(command: string): string[] {
    const words: string[] = [];
    let current = '';
    let quote = '';

    for (let i = 0; i < command.length; i += 1) {
        const char = command[i];
        if (quote) {
            if (char === quote && command[i - 1] !== '\\') quote = '';
            else current += char;
        } else if (char === '"' || char === "'") {
            quote = char;
        } else if (/\s/.test(char)) {
            if (current) words.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) words.push(current);
    return words;
}

function optionNames(command: string): Set<string> {
    return new Set(Array.from(command.matchAll(/(?:^|\s)--([A-Za-z][\w.-]*)(?==|\s|$)/g), (match) => match[1]));
}

const dataOptionNames = (() => {
    const command = addDataOptions(new Command());
    return new Set(command.options.map((option) => option.long?.slice(2)).filter(Boolean) as string[]);
})();

function resolveDocumentedAction(words: string[]): { module: ModuleDefinition; action: ModuleAction; actionIndex: number } | undefined {
    const moduleName = words[1];
    if (!moduleName || moduleName.includes('<') || BUILTIN_COMMANDS.has(moduleName)) return undefined;
    const module = getModule(moduleName);
    if (!module) throw new Error(`unknown module: ${moduleName}`);

    const candidate = words[2];
    if (!candidate || candidate.startsWith('--')) {
        return { module, action: getAction(module, 'list')!, actionIndex: 1 };
    }
    if (candidate === 'props' || candidate === 'help' || candidate.includes('/') || candidate === '...') return undefined;
    if (/^\d+$/.test(candidate) || /^<[^>]*id[^>]*>$/i.test(candidate)) {
        return { module, action: getAction(module, 'get')!, actionIndex: 1 };
    }
    if (candidate.includes('<')) return undefined;

    const action = getAction(module, candidate);
    if (!action) throw new Error(`unknown action: ${moduleName}/${candidate}`);
    return { module, action, actionIndex: 2 };
}

function allowedOptions(module: ModuleDefinition, action: ModuleAction): Set<string> {
    const params = getModuleActionParams(module.name, action.name);
    const allowed = new Set(params.map((param) => param.name));
    allowed.add('format');
    allowed.add('silent');
    allowed.add('params');
    allowed.add('options');

    for (const name of dataOptionNames) {
        if (['all', 'id', 'product', 'project', 'execution', 'page', 'recPerPage'].includes(name)) continue;
        if (['filter', 'sort', 'search', 'search-fields', 'limit'].includes(name) && action.type !== 'list') continue;
        if (name === 'pick' && action.type !== 'list' && action.type !== 'get') continue;
        if (name === 'data' && !['create', 'update', 'action'].includes(action.type)) continue;
        if (name === 'yes' && action.type !== 'delete') continue;
        if (name === 'batch-fail-fast' && ['list', 'get'].includes(action.type)) continue;
        allowed.add(name);
    }

    if (params.some((param) => param.name === 'pageID')) allowed.add('page');
    if (params.some((param) => param.name === 'recPerPage')) allowed.add('recPerPage');
    if (params.some((param) => param.role === 'path' && param.name.endsWith('ID'))) allowed.add('id');
    if (params.some((param) => param.role === 'path' && param.name === 'scope')) {
        for (const scope of ['product', 'project', 'execution']) {
            allowed.add(scope);
            allowed.add(`${scope}ID`);
        }
    }
    return allowed;
}

function missingRequiredParams(command: SkillCommand, words: string[], action: ModuleAction, actionIndex: number): string[] {
    if (/\s\.\.\.\s*$/.test(command.raw) || command.raw.includes('<module>')) return [];
    const provided = optionNames(command.raw);
    const params = getModuleActionParams(words[1], action.name);
    const opaqueBody = provided.has('data') || provided.has('params');
    const positional = words.slice(actionIndex + 1).some((word) => !word.startsWith('--') && (/^\d+$/.test(word) || /^<[^>]*id[^>]*>$/i.test(word)));
    const hasScope = ['product', 'project', 'execution'].some((scope) => provided.has(scope) || provided.has(`${scope}ID`))
        || (provided.has('scope') && provided.has('scopeID'));

    return params.flatMap((param) => {
        if (!param.required || param.defaultValue !== undefined) return [];
        if (param.role === 'path') {
            if (param.name === 'scope' || param.name === 'scopeID') return hasScope ? [] : [param.name];
            return provided.has(param.name) || provided.has('id') || positional ? [] : [param.name];
        }
        if (param.role === 'body' && (action.type === 'update' || opaqueBody)) return [];
        return provided.has(param.name) ? [] : [param.name];
    });
}

function contradictoryFilters(command: string): string[] {
    const issues: string[] = [];
    for (const match of command.matchAll(/--filter=(?:'([^']*)'|"([^"]*)"|([^\s#]+))/g)) {
        const values = new Map<string, string>();
        for (const condition of (match[1] ?? match[2] ?? match[3]).split(',')) {
            const equal = condition.match(/^\s*([\w.]+)\s*(?:=|:)\s*(.+?)\s*$/);
            if (!equal) continue;
            const previous = values.get(equal[1]);
            if (previous !== undefined && previous !== equal[2]) issues.push(`${equal[1]}=${previous}/${equal[2]}`);
            values.set(equal[1], equal[2]);
        }
    }
    return issues;
}

describe('bundled Skill command contracts', () => {
    test('all documented commands match the current CLI and SDK schemas', () => {
        const commands = extractSkillCommands();
        const issues: string[] = [];
        expect(commands.length).toBeGreaterThan(70);

        for (const command of commands) {
            const location = `${command.file}:${command.line}`;
            const words = shellWords(command.raw);
            try {
                const resolved = resolveDocumentedAction(words);
                if (!resolved) continue;
                if (words.includes('--help') || words.includes('-h')) continue;
                const provided = optionNames(command.raw);
                const allowed = allowedOptions(resolved.module, resolved.action);
                const unknown = Array.from(provided).filter((name) => !allowed.has(name));
                if (unknown.length) issues.push(`${location} unsupported option(s) --${unknown.join(', --')}: ${command.raw}`);

                const missing = missingRequiredParams(command, words, resolved.action, resolved.actionIndex);
                if (missing.length) issues.push(`${location} missing required ${missing.join(', ')}: ${command.raw}`);

                const filters = contradictoryFilters(command.raw);
                if (filters.length) issues.push(`${location} contradictory filter ${filters.join(', ')}: ${command.raw}`);
            } catch (error) {
                issues.push(`${location} ${(error as Error).message}: ${command.raw}`);
            }
        }

        expect(issues).toEqual([]);
    });

    test('all supported help forms work without authentication', async () => {
        for (const args of [
            ['help', 'bug'],
            ['bug', '--help'],
            ['bug', 'help'],
            ['bug', 'resolve', '--help'],
            ['bug', 'resolve', 'help'],
        ]) {
            const result = await runCliWithoutAuth(args);
            expect(result.exitCode, args.join(' ')).toBe(0);
            expect(result.stderr, args.join(' ')).toBe('');
            expect(result.stdout, args.join(' ')).not.toContain('E1001');
        }
    });

    test('module help advertises only working list controls', async () => {
        const result = await runCliWithoutAuth(['bug', '--help']);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('--limit <number>');
        expect(result.stdout).not.toContain('--all');
        expect(result.stdout).toContain('zentao bug <操作> --help');

        const unpaged = await runCliWithoutAuth(['release', '--help']);
        expect(unpaged.exitCode).toBe(0);
        expect(unpaged.stdout).not.toContain('--page <number>');
        expect(unpaged.stdout).not.toContain('--recPerPage <number>');

        const fixedScope = await runCliWithoutAuth(['task', 'list', '--help']);
        expect(fixedScope.exitCode).toBe(0);
        expect(fixedScope.stdout).toContain('--executionID <number>');

        const create = await runCliWithoutAuth(['execution', 'create', '--help']);
        expect(create.exitCode).toBe(0);
        expect(create.stdout).not.toContain('--pick <fields>');
    });
});
