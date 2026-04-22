import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const BUILD_VERSION: string | undefined;

/** 从 `package.json` 读取 CLI 版本，兼容 dev（src/utils/）和 production（dist/ 或 dist/utils/）布局 */
export function getCliVersion(): string {
    if (typeof BUILD_VERSION !== 'undefined') {
        return BUILD_VERSION;
    }
    const thisFile = fileURLToPath(import.meta.url);
    const thisDir = dirname(thisFile);
    // 从当前文件位置向上逐层查找 package.json
    const candidates = [
        join(thisDir, '..', 'package.json'),       // dist/ 场景：dist/utils/ -> dist/ -> package.json
        join(thisDir, '..', '..', 'package.json'), // src/utils/ 开发场景 或 dist/utils/ -> package.json
        join(thisDir, '..', '..', '..', 'package.json'), // node_modules 安装场景
    ];
    for (const candidate of candidates) {
        try {
            if (!existsSync(candidate)) continue;
            const pkg = JSON.parse(readFileSync(candidate, 'utf-8'));
            if (typeof pkg.version === 'string' && typeof pkg.name === 'string' && pkg.bin) {
                // 只认取到的是 CLI 自己的 package.json（带 bin 字段），避免匹配到无关 package.json
                return pkg.version;
            }
        } catch {
            // 继续尝试下一个
        }
    }
    return 'unknown';
}
