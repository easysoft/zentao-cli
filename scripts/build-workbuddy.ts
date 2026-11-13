import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json';
import { verifyWorkbuddyConfiguration, verifyWorkbuddyLifecycle } from './workbuddy-validation.js';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(projectDir, 'connectors', 'workbuddy');
const meta = JSON.parse(readFileSync(join(sourceDir, 'connector-meta.json'), 'utf8'));
const local = process.argv.slice(2).includes('--local');
assert.ok(process.argv.slice(2).every(arg => arg === '--local'), 'Usage: bun run build:workbuddy [--local]');

assert.match(meta.source, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
assert.match(meta.version, /^\d+\.\d+\.\d+$/);
verifyWorkbuddyConfiguration();
for (const key of ['name', 'name_en', 'description', 'description_zh', 'description_en']) {
    assert.ok(typeof meta[key] === 'string' && meta[key].trim(), `Missing ${key}`);
}
for (const language of ['zh', 'en']) {
    const examples = meta[`examples_${language}`];
    assert.ok(Array.isArray(examples) && examples.length >= 2 && examples.length <= 5);
    assert.ok(examples.every((example: unknown) => typeof example === 'string' && example.trim()));
}

const node = Bun.which('node');
assert.ok(node, 'Node.js 22 is required to validate the WorkBuddy runtime');
const runtime = execFileSync(node, ['--version'], { encoding: 'utf8' }).trim();
assert.match(runtime, /^v22\./,
    `WorkBuddy validation requires Node.js 22 to match mcp.json; found ${runtime}.\n` +
    `With fnm, run: fnm exec --using=22 bun run build:workbuddy${local ? ' --local' : ''}`);
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
    // Validate the installed package's stdio protocol and authentication, not just its version string.
    validation = await verifyWorkbuddyLifecycle(node, entry);
    const report = { validatedAt: new Date().toISOString(), mode: local ? 'local-preview' : 'published', cliVersion: pkg.version, node: runtime,
        artifactSha256: createHash('sha256').update(readFileSync(join(installedPackage, 'dist', 'index.js'))).digest('hex'), ...validation };
    mkdirSync(reportDir, { recursive: true });
    buildConnector(reportDir, !local);
    if (local) copyFileSync(spec, join(previewDir, `zentao-cli-${pkg.version}.tgz`));
    writeFileSync(join(reportDir, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
    if (local) {
        console.log(`Local npm artifact validated: ${join(previewDir, 'validation.json')}. Publish the compatible CLI before creating a submission ZIP.`);
    }
} finally {
    rmSync(temporary, { recursive: true, force: true });
}

function buildConnector(outputDir: string, archive: boolean): void {
    const connectorDir = join(outputDir, meta.source);
    const archivePath = join(outputDir, `${meta.source}-workbuddy-${meta.version}.zip`);
    const skillDir = join(connectorDir, 'skills', 'zentao-mcp');
    const skillSource = join(sourceDir, 'skills', 'zentao-mcp', 'SKILL.md');
    const skill = readFileSync(skillSource, 'utf8');
    const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(frontmatter, 'MCP Skill must have YAML frontmatter');
    const metadata = Bun.YAML.parse(frontmatter[1]) as Record<string, unknown>;
    assert.equal(metadata.name, 'zentao-mcp');
    assert.ok(typeof metadata.description === 'string' && metadata.description.trim(), 'Missing Skill description');

    // Replace only this generated connector, so stale archive entries cannot survive a rebuild.
    rmSync(connectorDir, { recursive: true, force: true });
    rmSync(archivePath, { force: true });
    mkdirSync(skillDir, { recursive: true });
    for (const file of ['connector-meta.json', 'mcp.json', 'token-schema.json', 'empty-config.json', 'icon.png', 'README.md']) {
        copyFileSync(join(sourceDir, file), join(connectorDir, file));
    }
    copyFileSync(skillSource, join(skillDir, 'SKILL.md'));

    if (archive) {
        execFileSync('zip', ['-q', '-X', '-r', archivePath, meta.source], { cwd: outputDir, stdio: 'inherit' });
        execFileSync('unzip', ['-tq', archivePath], { stdio: 'inherit' });
        console.log(`WorkBuddy connector: ${archivePath}`);
        console.log('Published npm artifact and connector lifecycle validation passed.');
    } else {
        console.log(`Preview resource files validated: ${connectorDir}`);
    }
}
