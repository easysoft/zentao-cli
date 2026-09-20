import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(projectDir, 'connectors', 'workbuddy');
const meta = JSON.parse(readFileSync(join(sourceDir, 'connector-meta.json'), 'utf8'));
const cli = JSON.parse(readFileSync(join(sourceDir, 'cli.json'), 'utf8'));

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
assert.ok(new RegExp(cli.statusMatch).test(JSON.stringify({ currentProfile: 'user@https://zentao.example.com' })));
assert.ok(!new RegExp(cli.statusMatch).test(JSON.stringify({ currentProfile: '' })));

const outputDir = join(projectDir, 'release', 'workbuddy');
const connectorDir = join(outputDir, meta.source);
const archivePath = join(outputDir, `${meta.source}-workbuddy-${meta.version}.zip`);
const skillDir = join(connectorDir, 'skills', 'zentao-cli');
const notes = readFileSync(join(sourceDir, 'skill-notes.md'), 'utf8');
const skillSource = join(projectDir, 'skills', 'zentao-cli');
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

execFileSync('zip', ['-q', '-X', '-r', archivePath, meta.source], { cwd: outputDir, stdio: 'inherit' });
execFileSync('unzip', ['-tq', archivePath], { stdio: 'inherit' });
console.log(`WorkBuddy connector: ${archivePath}`);
console.log('首次需在终端登录；请随包说明 README.md 中的审核兼容性限制。');
