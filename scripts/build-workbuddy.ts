import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json';
import { verifyWorkbuddyLifecycle } from './workbuddy-validation.js';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(projectDir, 'connectors', 'workbuddy');
const meta = JSON.parse(readFileSync(join(sourceDir, 'connector-meta.json'), 'utf8'));
const cli = JSON.parse(readFileSync(join(sourceDir, 'cli.json'), 'utf8'));
const local = process.argv.slice(2).includes('--local');
assert.ok(process.argv.slice(2).every(arg => arg === '--local'), 'Usage: bun run build:workbuddy [--local]');

assert.match(meta.source, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
assert.match(meta.version, /^\d+\.\d+\.\d+$/);
assert.equal(meta.type, 'cli');
assert.equal(meta.minWorkbuddyVersion, '4.24.0');
for (const key of ['name', 'name_en', 'description', 'description_zh', 'description_en']) {
    assert.ok(typeof meta[key] === 'string' && meta[key].trim(), `Missing ${key}`);
}
for (const language of ['zh', 'en']) {
    const examples = meta[`examples_${language}`];
    assert.ok(Array.isArray(examples) && examples.length >= 2 && examples.length <= 5);
    assert.ok(examples.every((example: unknown) => typeof example === 'string' && example.trim()));
}
for (const platform of ['darwin', 'linux', 'win32']) {
    for (const action of ['init', 'auth', 'status', 'unAuth']) {
        assert.ok(cli[action]?.[platform], `Missing ${action}.${platform}`);
    }
    assert.ok(cli.init[platform].includes(`zentao-cli@${pkg.version} `), 'CLI and Skill versions must match');
}
assert.ok(new RegExp(cli.statusMatch).test(JSON.stringify({ ok: true, data: { account: 'user' } })));
assert.ok(!new RegExp(cli.statusMatch).test(JSON.stringify({ ok: false })));
assert.equal(cli.versionCheck.minVersion, pkg.version, 'versionCheck must match the installed CLI');

const node = Bun.which('node');
assert.ok(node, 'Node.js 22 is required to validate the WorkBuddy runtime');
const runtime = execFileSync(node, ['--version'], { encoding: 'utf8' }).trim();
assert.match(runtime, /^v22\./, 'Use Node.js 22 on PATH, matching cli.json runtime');
const temporary = mkdtempSync(join(tmpdir(), 'zentao-workbuddy-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = { ...process.env, npm_config_cache: join(temporary, 'cache') };
const prefix = join(temporary, 'install');
const previewDir = join(projectDir, 'release', 'workbuddy-preview');
const reportDir = local ? previewDir : join(projectDir, 'release', 'workbuddy');
rmSync(join(reportDir, 'validation.json'), { force: true });
if (local) rmSync(join(previewDir, 'live-validation.json'), { force: true });
let installedPackage: string;
let validation: Awaited<ReturnType<typeof verifyWorkbuddyLifecycle>>;
try {
    let spec = `zentao-cli@${pkg.version}`;
    if (local) {
        console.log('Building and packing the local CLI; this does not create a submission ZIP.');
        execFileSync(process.execPath, ['run', 'build'], { cwd: projectDir, env, stdio: 'inherit' });
        const packed = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], { cwd: projectDir, env, encoding: 'utf8', shell: process.platform === 'win32' }));
        spec = join(temporary, packed[0].filename);
    }
    console.log(`Installing ${local ? 'the local npm tarball' : spec} into a temporary prefix...`);
    execFileSync(npm, ['install', '--global', spec, '--prefix', prefix, '--registry', 'https://registry.npmjs.org', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: temporary, env, stdio: 'inherit', timeout: 240_000, shell: process.platform === 'win32',
    });
    installedPackage = join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', 'zentao-cli');
    assert.equal(JSON.parse(readFileSync(join(installedPackage, 'package.json'), 'utf8')).version, pkg.version);
    const entry = join(installedPackage, 'bin', 'zentao.js');
    assert.equal(execFileSync(node, [entry, '--version'], { encoding: 'utf8' }).trim(), pkg.version);
    // A matching version string is insufficient: published 0.4.0 has a different command tree.
    for (const [command, flags] of [['login', ['--web', '--no-open', '--select']], ['status', ['--verify']], ['logout', ['--all', '--revoke']]] as const) {
        const help = execFileSync(node, [entry, 'auth', command, '--help'], { encoding: 'utf8' });
        for (const flag of flags) assert.ok(help.includes(flag), `Installed zentao-cli@${pkg.version} lacks auth ${command} ${flag}; publish a compatible version before building the submission ZIP.`);
    }
    validation = await verifyWorkbuddyLifecycle(cli, node, entry);
    const report = { validatedAt: new Date().toISOString(), mode: local ? 'local-preview' : 'published', cliVersion: pkg.version, node: runtime,
        artifactSha256: createHash('sha256').update(readFileSync(join(installedPackage, 'dist', 'index.js'))).digest('hex'), ...validation };
    mkdirSync(reportDir, { recursive: true });
    buildConnector(installedPackage, reportDir, !local);
    if (local) copyFileSync(spec, join(previewDir, `zentao-cli-${pkg.version}.tgz`));
    writeFileSync(join(reportDir, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
    if (local) {
        console.log(`Local npm artifact validated: ${join(previewDir, 'validation.json')}. Publish the compatible CLI before creating a submission ZIP.`);
    }
} finally {
    rmSync(temporary, { recursive: true, force: true });
}

function buildConnector(installedPackage: string, outputDir: string, archive: boolean): void {
    const connectorDir = join(outputDir, meta.source);
    const archivePath = join(outputDir, `${meta.source}-workbuddy-${meta.version}.zip`);
    const skillDir = join(connectorDir, 'skills', 'zentao-cli');
    const notes = readFileSync(join(sourceDir, 'skill-notes.md'), 'utf8');
    // Ship the Skill from the exact installed release, never from a possibly newer worktree.
    const skillSource = join(installedPackage, 'skills', 'zentao-cli');
    const skillFiles = ['SKILL.md', 'references/data-output.md', 'references/writes.md'];
    const commandPrefix = 'zentao --config "~/.config/zentao/workbuddy.json" ';

    // Replace only this generated connector, so stale archive entries cannot survive a rebuild.
    rmSync(connectorDir, { recursive: true, force: true });
    rmSync(archivePath, { force: true });
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    for (const file of ['connector-meta.json', 'cli.json', 'icon.png', 'README.md']) {
        copyFileSync(join(sourceDir, file), join(connectorDir, file));
    }
    for (const file of skillFiles) {
        let content = readFileSync(join(skillSource, file), 'utf8').replaceAll('zentao ', commandPrefix);
        if (file === 'SKILL.md') {
            const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            assert.ok(frontmatter, 'Skill must have YAML frontmatter');
            const metadata = Bun.YAML.parse(frontmatter[1]) as Record<string, unknown>;
            for (const key of ['name', 'description', 'description_zh', 'description_en', 'version', 'author']) {
                assert.ok(typeof metadata[key] === 'string' && metadata[key].trim(), `Missing Skill ${key}`);
            }
            assert.equal(metadata.version, pkg.version, 'CLI and Skill versions must match');
            const heading = '# 禅道 CLI\n';
            assert.ok(content.includes(heading), 'Skill heading changed; review the WorkBuddy notes insertion');
            content = content.replace(heading, `${heading}\n${notes.trim()}\n`);
        }
        writeFileSync(join(skillDir, file), content);
    }
    for (const file of skillFiles) {
        const content = readFileSync(join(skillDir, file), 'utf8');
        for (const [, target] of content.matchAll(/\]\(([^)]+\.md)\)/g)) {
            assert.ok(existsSync(resolve(dirname(join(skillDir, file)), target)), `Missing Skill reference: ${target}`);
        }
    }

    if (archive) {
        execFileSync('zip', ['-q', '-X', '-r', archivePath, meta.source], { cwd: outputDir, stdio: 'inherit' });
        execFileSync('unzip', ['-tq', archivePath], { stdio: 'inherit' });
        console.log(`WorkBuddy connector: ${archivePath}`);
        console.log('Published npm artifact and connector lifecycle validation passed.');
    } else {
        console.log(`Preview resource files validated: ${connectorDir}`);
    }
}
