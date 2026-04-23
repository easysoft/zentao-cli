/** 是否在 Bun 环境中 */
const isBun = typeof Bun !== 'undefined';

/** Bun 环境是否支持 Markdown ANSI 渲染 */
export const bunMarkdownEnable = isBun && typeof Bun.markdown.ansi === 'function';

// 定义美化输出的等级：none-无美化, basic-基础美化, full-完全美化
export const PRETTY_LEVEL = {none: 0, basic: 1, full: 2} as const;

// PRETTY_LEVEL 名称类型
export type PrettyLevelName = keyof typeof PRETTY_LEVEL;

// PRETTY_LEVEL 数值类型
export type PrettyLevel = (typeof PRETTY_LEVEL)[PrettyLevelName];

/**
 * 根据参数和环境变量智能判断当前的美化输出等级
 * - 机器可读参数（如 --json）最高优先，直接无美化
 * - 显式关闭色彩（如 --no-color）也无美化
 * - 显式开启色彩（如 --color=always）根据是否是终端区分 full/basic
 * - CI 环境下为 basic，否则终端则 full
 */
function getPrettyLevel(argv = process.argv, env = process.env): PrettyLevel {
    const has = (flag: string) => argv.includes(flag);

    // 1）如需机器可读优先，则无美化
    if (has('--machine-readable')) return PRETTY_LEVEL.none;

    // 2）显式关闭美化
    if (has("--no-color") || has("--plain") || env.NO_COLOR === "1") return PRETTY_LEVEL.none;

    // 3）显式强制开启美化
    if (has("--color=always") || env.FORCE_COLOR === "1") {
        // 终端下 full，否则 basic
        return process.stdout.isTTY ? PRETTY_LEVEL.full : PRETTY_LEVEL.basic;
    }

    // 4）自动适配：非终端禁用美化，CI 环境 basic
    if (!process.stdout.isTTY) return PRETTY_LEVEL.none;
    if (env.CI === "true") return PRETTY_LEVEL.basic;

    // 默认：全量美化
    return PRETTY_LEVEL.full;
}

// 全局美化级别常量
export const prettyLevel = getPrettyLevel();

/**
 * 检查当前全局美化级别是否高于指定级别（支持名字和数值）
 */
export function isPrettyLevel(level: PrettyLevel | PrettyLevelName): boolean {
    return prettyLevel >= (typeof level === 'string' ? PRETTY_LEVEL[level] : level);
}
