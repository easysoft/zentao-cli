import { describe, expect, test } from 'bun:test';

async function executeCreateWithStdin(dataOption: string | undefined, input: string) {
    const code = `
        import { DEFAULT_CONFIG } from './src/config/defaults.ts';
        import { getModule } from './src/modules/index.ts';
        import { executeModuleCommand } from './src/modules/executor.ts';

        const requests = [];
        const client = {
            async request(path, options) {
                requests.push({ path, options });
                return { status: 'success', id: 1 };
            },
        };

        try {
            await executeModuleCommand(
                client,
                getModule('user'),
                'create',
                [],
                ${dataOption === undefined ? '{}' : `{ data: ${JSON.stringify(dataOption)} }`},
                DEFAULT_CONFIG,
            );
            process.stdout.write(JSON.stringify({ body: requests[0].options.body }));
        } catch (error) {
            process.stdout.write(JSON.stringify({ code: error.code }));
        }
    `;
    const proc = Bun.spawn({
        cmd: [process.execPath, '-e', code],
        cwd: process.cwd(),
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
    });
    proc.stdin.write(input);
    proc.stdin.end();

    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
    return JSON.parse(stdout) as { body?: unknown; code?: string };
}

describe('module stdin data', () => {
    const data = JSON.stringify({ account: 'dev1', realname: 'Dev One', password: 'secret' });

    test('resolves --data @- before executing a create action', async () => {
        expect(await executeCreateWithStdin('@-', data)).toEqual({
            body: { account: 'dev1', realname: 'Dev One', password: 'secret' },
        });
    });

    test('uses piped JSON when --data is omitted', async () => {
        expect(await executeCreateWithStdin(undefined, data)).toEqual({
            body: { account: 'dev1', realname: 'Dev One', password: 'secret' },
        });
    });

    test('maps malformed piped JSON to E2007', async () => {
        expect(await executeCreateWithStdin('@-', '{"account":}')).toEqual({ code: '2007' });
    });
});
