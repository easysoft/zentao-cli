import { chmodSync } from 'node:fs';
import pkg from '../package.json';

const compile = process.argv.includes('--compile');

const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    outdir: 'dist',
    target: 'node',
    format: 'esm',
    sourcemap: process.argv.includes('--sourcemap'),
    bytecode: process.argv.includes('--bytecode'),
    minify: process.argv.includes('--minify'),
    ...(compile ? {
        compile: {
            target: 'bun-darwin-arm64',
            outfile: pkg.name,
        },
    } : {}),
    define: {
        BUILD_TIME: Date.now().toString(),
    },
});

if (!result.success) {
    console.error('Build failed:');
    for (const log of result.logs) {
        console.error(log);
    }
    process.exit(1);
}

if (compile) {
    console.log(`Build succeeded: ${pkg.name}`);
} else {
    chmodSync('bin/zentao.js', 0o755);
    console.log('Build succeeded: dist/index.js');
}
