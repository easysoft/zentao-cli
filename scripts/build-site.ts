import { cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBrand, option, outputDirectory, prepareOutput } from './brand-config.js';
import { buildDistribution, writeBrandAssets } from './build-distribution.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const brandFile = option(args, '--brand');
const outdir = option(args, '--outdir');
const destination = outdir ? outputDirectory(outdir, project) : join(project, 'site/dist');
if (outdir) prepareOutput(destination);
const env = { ...process.env };
if (brandFile) {
    if (!outdir) throw new Error('--brand requires --outdir');
    const inputs = join(destination, '..', '.site-inputs');
    await buildDistribution(brandFile, join(inputs, 'documents'));
    cpSync(join(project, 'site/public'), join(inputs, 'public'), { recursive: true });
    cpSync(join(project, 'LICENSE'), join(inputs, 'public/LICENSE'));
    writeBrandAssets(join(inputs, 'public/brand'), loadBrand(brandFile));
    env.CLI_BRAND_FILE = resolve(brandFile);
    env.CLI_DOCUMENT_ROOT = join(inputs, 'documents');
    env.CLI_PUBLIC_DIR = join(inputs, 'public');
}
const check = Bun.spawnSync([process.execPath, 'run', 'tsc', '--noEmit'], { cwd: join(project, 'site'), stdout: 'inherit', stderr: 'inherit' });
if (check.exitCode) process.exit(check.exitCode);
const result = Bun.spawnSync([process.execPath, '--bun', 'vite', 'build', '--outDir', destination], { cwd: join(project, 'site'), env, stdout: 'inherit', stderr: 'inherit' });
if (result.exitCode) process.exit(result.exitCode);
