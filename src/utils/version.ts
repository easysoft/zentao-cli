import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 从当前工作目录的 `package.json` 读取 CLI 版本（开发与本地运行场景） */
export function getCliVersion(): string {
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);
    const packageJsonPath = join(thisDir, '..', 'package.json');
    try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return pkg.version ?? 'unknown';
    } catch {
        return 'unknown';
    }
}
