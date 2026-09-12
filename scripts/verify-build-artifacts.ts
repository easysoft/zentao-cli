import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDir = mkdtempSync(join(tmpdir(), 'zentao-cli-artifacts-'));
const runtimeDir = join(temporaryDir, 'runtime');
const nodeExecutable = process.argv[2] ?? 'node';
const env = {
    ...process.env,
    ZENTAO_URL: '',
    ZENTAO_ACCOUNT: '',
    ZENTAO_PASSWORD: '',
    ZENTAO_TOKEN: '',
};

function run(command: string[], cwd: string, expectedExitCode = 0): string {
    const result = Bun.spawnSync(command, { cwd, env, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
    const output = result.stdout.toString() + result.stderr.toString();
    assert.equal(result.exitCode, expectedExitCode, output);
    return output;
}

function listFiles(directory: string): string[] {
    return [...new Bun.Glob('**/*').scanSync({ cwd: directory, onlyFiles: true, dot: true })].sort();
}

try {
    mkdirSync(runtimeDir);
    const configPath = join(temporaryDir, 'config.json');
    writeFileSync(configPath, JSON.stringify({ profiles: [] }));
    const executable = join(temporaryDir, process.platform === 'win32' ? 'zentao.exe' : 'zentao');

    run([process.execPath, 'scripts/build.ts', '--compile', '--minify', '--outfile', executable], projectDir);

    const sourceDir = join(projectDir, 'skills');
    const expectedFiles = listFiles(sourceDir);
    assert.ok(expectedFiles.length > 0);

    for (const [name, command] of [
        ['node', [nodeExecutable, join(projectDir, 'bin', 'zentao.js')]],
        ['standalone', [executable]],
    ] as const) {
        const outputDir = join(temporaryDir, `${name}-skills`);
        run([...command, '--config', configPath, 'add-skill', '--output', outputDir], runtimeDir);
        assert.deepEqual(listFiles(outputDir), expectedFiles);
        for (const file of expectedFiles) {
            assert.deepEqual(readFileSync(join(outputDir, file)), readFileSync(join(sourceDir, file)), file);
        }

        // Repeated exports replace bundled files without deleting unrelated user files.
        writeFileSync(join(outputDir, expectedFiles[0]), 'outdated');
        writeFileSync(join(outputDir, 'user-note.txt'), 'keep');
        run([...command, '--config', configPath, 'add-skill', '--output', outputDir], runtimeDir);
        assert.deepEqual(readFileSync(join(outputDir, expectedFiles[0])), readFileSync(join(sourceDir, expectedFiles[0])));
        assert.equal(readFileSync(join(outputDir, 'user-note.txt'), 'utf-8'), 'keep');

        const conflictDir = join(temporaryDir, `${name}-conflict`);
        mkdirSync(conflictDir);
        writeFileSync(join(conflictDir, 'zentao-tour'), 'existing file');
        const error = run([...command, '--config', configPath, 'add-skill', '--output', conflictDir], runtimeDir, 1);
        assert.match(error, /技能目标路径必须是目录/);
        assert.equal(existsSync(join(conflictDir, 'zentao-cli')), false);
        assert.equal(readFileSync(join(conflictDir, 'zentao-tour'), 'utf-8'), 'existing file');
        console.log(`Verified ${name} skill export: ${expectedFiles.length} files`);
    }
} finally {
    rmSync(temporaryDir, { recursive: true, force: true });
}
