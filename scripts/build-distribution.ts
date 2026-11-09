import { chmodSync, copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { formatBrandText, type ResolvedBrand } from '../src/brand.js';
import { brandDocument, loadBrand, option, outputDirectory, prepareOutput } from './brand-config.js';

const project = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));

export function copyDocuments(source: string, destination: string, brand?: ResolvedBrand, prefix = ''): void {
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
        const name = formatBrandText(entry.name, brand);
        const from = join(source, entry.name), to = join(destination, name);
        const file = join(prefix, entry.name);
        if (entry.isDirectory()) copyDocuments(from, to, brand, file);
        else if (/\.(md|html|yaml|yml|json|svg|txt)$/.test(name)) {
            let content = brandDocument(readFileSync(from, 'utf8'), brand, file);
            if (brand) content = content.replace(new RegExp(`${brand.packageName}@[0-9]+\\.[0-9]+\\.[0-9]+(?:-[\\w.-]+)?`, 'g'), `${brand.packageName}@${pkg.version}`);
            if (name === 'SKILL.md' && brand) content = content.replace(/^(\s*version:)\s*[^\n]+/gm, `$1 "${pkg.version}"`);
            writeFileSync(to, content);
        } else copyFileSync(from, to);
    }
}

export function writeBrandAssets(directory: string, brand?: ResolvedBrand): void {
    if (!brand?.logoSvg) return;
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'logo.svg'), brand.logoSvg);
    for (const [name, size] of [['pixel-tao-terminal-blue-flat.svg', 0], ['pixel-tao-terminal-blue.svg', 0], ['pixel-tao-reverse.svg', 0], ['pixel-tao-terminal-blue-512.png', 512], ['favicon.png', 32], ['icon.png', 1024]] as const) {
        writeFileSync(join(directory, name), size ? new Resvg(brand.logoSvg, { fitTo: { mode: 'width', value: size } }).render().asPng() : brand.logoSvg);
    }
}

export async function buildDistribution(brandFile: string, outdir: string): Promise<void> {
    const brand = loadBrand(brandFile)!;
    prepareOutput(outdir);
    mkdirSync(join(outdir, 'dist'), { recursive: true });
    const result = await Bun.build({
        entrypoints: [join(project, 'src/index.ts')], outdir: join(outdir, 'dist'), target: 'node', format: 'esm', packages: 'external', minify: true,
        define: { BUILD_VERSION: JSON.stringify(pkg.version), BUILD_BRAND: JSON.stringify(brand), BUILD_SKILL_FILES: 'undefined' },
    });
    if (!result.success) throw new AggregateError(result.logs, 'Brand build failed');
    mkdirSync(join(outdir, 'bin'), { recursive: true });
    const bin = join(outdir, 'bin', `${brand.commandName}.js`);
    writeFileSync(bin, "#!/usr/bin/env node\nimport('../dist/index.js');\n");
    chmodSync(bin, 0o755);
    for (const directory of ['docs', 'skills']) copyDocuments(join(project, directory), join(outdir, directory), brand, directory);
    for (const file of ['README.md', 'README.en.md', 'CHANGES.md']) writeFileSync(join(outdir, file), brandDocument(readFileSync(join(project, file), 'utf8'), brand, file));
    copyFileSync(join(project, 'LICENSE'), join(outdir, 'LICENSE'));
    writeBrandAssets(join(outdir, 'skills', `${brand.commandName}-cli`, 'assets'), brand);
    const { scripts, devDependencies, repository, ...manifest } = pkg;
    Object.assign(manifest, { name: brand.packageName, description: formatBrandText(pkg.description, brand), homepage: brand.homepage,
        keywords: pkg.keywords.map((value: string) => formatBrandText(value, brand)), bin: { [brand.commandName]: `./bin/${brand.commandName}.js` },
        files: ['bin', 'dist', 'skills', 'docs', 'README.md', 'README.en.md', 'CHANGES.md', 'LICENSE', 'UPSTREAM.json'],
    });
    if (brand.repository) manifest.repository = { type: 'git', url: brand.repository };
    writeFileSync(join(outdir, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    const generated = Bun.spawnSync([process.execPath, 'run', join(project, 'scripts/generate-command-reference.ts'), '--brand', resolve(brandFile), '--outdir', outdir], { cwd: project, stdout: 'inherit', stderr: 'inherit' });
    if (generated.exitCode) throw new Error('Command reference generation failed');
    console.log(`Built ${brand.packageName}@${pkg.version}: ${outdir}`);
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const brand = option(args, '--brand');
    if (!brand) throw new Error('--brand is required');
    await buildDistribution(brand, outputDirectory(option(args, '--outdir'), project));
}
