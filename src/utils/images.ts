import type { ZentaoClient } from '../api/index.js';
import { uploadFile, type UploadedFile } from 'zentao-api';
import { resolve } from 'node:path';
import { existsSync, lstatSync } from 'node:fs';
import { ZentaoError } from '../errors.js';

/** 图片标记正则：匹配 ![alt](path) 格式。 */
const IMAGE_MARKER_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
/** 图片标记正则（无 g 标志，用于 test 检测）。 */
const IMAGE_MARKER_RE_TEST = /!\[([^\]]*)\]\(([^)]+)\)/;

/** 解析出的图片标记。 */
export interface ImageMarker {
  /** 完整原始标记文本。 */
  fullMatch: string;
  /** 图片描述。 */
  alt: string;
  /** 本地文件路径。 */
  path: string;
  /** 在原文中的起始位置。 */
  index: number;
}

/**
 * 从内容文本中解析所有图片标记。
 *
 * @param content - 包含图片标记的内容文本。 * @returns 解析出的图片标记列表。
 */
export function parseImageMarkers(content: string): ImageMarker[] {
  const markers: ImageMarker[] = [];
  if (!content) return markers;

  for (const match of content.matchAll(IMAGE_MARKER_RE)) {
    const [fullMatch, alt, path] = match;
    if (fullMatch === undefined || alt === undefined || path === undefined) continue;
    markers.push({
      fullMatch,
      alt,
      path,
      index: match.index ?? 0,
    });
  }
  return markers;
}

/**
 * 判断内容中是否包含图片标记。
 *
 * @param content - 内容文本。
 * @returns 是否包含图片标记。
 */
export function hasImageMarkers(content: string): boolean {
  if (!content) return false;
  return IMAGE_MARKER_RE_TEST.test(content);
}
/**
 * 解析图片标记中的路径为绝对路径。
 *
 * @param rawPath - 标记中的原始路径。
 * @param baseDir - 解析相对路径时的基准目录。
 * @returns 绝对路径。
 */
export function resolveImagePath(rawPath: string, baseDir: string): string {
  if (rawPath.startsWith('/')) return rawPath;
  if (rawPath.startsWith('~')) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
    return rawPath.replace(/^~/, home);
  }
  return resolve(baseDir, rawPath);
}

/** 上传图片并替换内容中的标记。 */
export interface ProcessImageOptions {
  /** 解析相对路径时的基准目录。 */
  baseDir?: string;
  /** 是否显示上传进度。 */
  verbose?: boolean;
  /** 关联的对象类型（如 story、bug），上传时传给禅道。 */
  objectType?: string;
}

/**
 * 上传内容中所有图片标记引用的本地文件，并将标记替换为禅道图片引用格式。
 *
 * @param client - 已认证的 ZentaoClient 实例。
 * @param content - 包含图片标记的内容文本。
 * @param options - 处理选项。
 * @returns 替换后的内容文本。
 */
export async function processImagesInContent(
  client: ZentaoClient,
  content: string,
  options: ProcessImageOptions = {},
): Promise<string> {
  const markers = parseImageMarkers(content);
  if (markers.length === 0) return content;

  const baseDir = options.baseDir ?? process.cwd();
  let result = content;
  const uploadCache = new Map<string, UploadedFile>();

  for (const marker of markers) {
    const absPath = resolveImagePath(marker.path, baseDir);

    if (!existsSync(absPath) || !lstatSync(absPath).isFile()) {
      throw new ZentaoError('E2011', { path: marker.path, resolved: absPath });
    }

    let uploaded = uploadCache.get(absPath);
    if (!uploaded) {
      if (options.verbose) {
        console.error(`上传图片: ${absPath}`);
      }
      uploaded = await uploadFile(client, absPath, {
        objectType: options.objectType,
        objectID: 0,
      });
      uploadCache.set(absPath, uploaded);
    }

    const replacement = `<img src="${uploaded.url}" alt="${marker.alt}" />`;
    result = result.replace(marker.fullMatch, replacement);
  }

  return result;
}
