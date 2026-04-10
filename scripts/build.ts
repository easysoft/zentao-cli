import { chmodSync } from 'node:fs';

const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'node',
    format: 'esm',
    minify: process.argv.includes('--minify'),
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

chmodSync('bin/zentao.js', 0o755);
console.log('Build succeeded: dist/index.js');
