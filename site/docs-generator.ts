import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, posix } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt, { type Token } from "markdown-it";
import GithubSlugger from "github-slugger";
import sanitizeHtml from "sanitize-html";
import type { Plugin } from "vite";
import { renderCommandExplorer } from "./command-explorer.js";

const siteRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(siteRoot, "..");
const docsDirectory = resolve(repositoryRoot, "docs");
const templatePath = resolve(siteRoot, "docs-template.html");
const explorerPath = resolve(docsDirectory, "command-reference.html");
const repositoryUrl = "https://github.com/easysoft/zentao-cli/blob/main/";

export type DocumentationSource = {
  sourcePath: string;
  fileName: string;
  title: string;
};

export type DocumentationHeading = {
  title: string;
  id: string;
  level: number;
};

export type DocumentationSearchEntry = {
  title: string;
  heading: string;
  url: string;
  text: string;
};

export type DocumentationPage = DocumentationSource & {
  description: string;
  content: string;
  headings: DocumentationHeading[];
  search: DocumentationSearchEntry[];
};

const preferredDocuments: DocumentationSource[] = [
  { sourcePath: "README.md", fileName: "index.html", title: "项目概览" },
  {
    sourcePath: "docs/use-zentao-in-agents.md",
    fileName: "use-zentao-in-agents.html",
    title: "在 Agents 中使用",
  },
  {
    sourcePath: "docs/cli-usage.md",
    fileName: "cli-usage.html",
    title: "CLI 核心功能",
  },
  {
    sourcePath: "docs/command-reference.md",
    fileName: "command-reference.html",
    title: "命令与参数参考",
  },
  { sourcePath: "docs/errors.md", fileName: "errors.html", title: "错误排查" },
  {
    sourcePath: "docs/development.md",
    fileName: "development.html",
    title: "开发指引",
  },
  {
    sourcePath: "docs/implementation.md",
    fileName: "implementation.html",
    title: "技术方案与实现",
  },
  {
    sourcePath: "docs/roadmap.md",
    fileName: "roadmap.html",
    title: "后续计划",
  },
  { sourcePath: "CHANGES.md", fileName: "changelog.html", title: "更新日志" },
];

const rawHtmlTags = new Set(["a", "br", "details", "summary"]);

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function getDocumentationSources(): DocumentationSource[] {
  const names = readdirSync(docsDirectory)
    .filter((name) => name.endsWith(".md"))
    .sort();
  const sourcePaths = new Set([
    "README.md",
    "CHANGES.md",
    ...names.map((name) => `docs/${name}`),
  ]);
  const sources = preferredDocuments.filter((document) =>
    sourcePaths.has(document.sourcePath),
  );
  const knownSources = new Set(sources.map((document) => document.sourcePath));
  for (const name of names) {
    const sourcePath = `docs/${name}`;
    if (!knownSources.has(sourcePath)) {
      const source = readFileSync(resolve(repositoryRoot, sourcePath), "utf8");
      sources.splice(sources.length - 1, 0, {
        sourcePath,
        fileName: name.replace(/\.md$/, ".html"),
        title: source.match(/^#\s+(.+)$/m)?.[1] || name.replace(/\.md$/, ""),
      });
    }
  }
  return sources;
}

/** Resolve links relative to the Markdown source, then make document routes local. */
export function rewriteDocumentationLink(
  href: string,
  sourcePath: string,
  sources: DocumentationSource[] = getDocumentationSources(),
  image = false,
): string {
  if (!href || href.startsWith("#") || href.startsWith("?")) return href;
  const parts = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (!parts) return href;
  const [, rawPath, query = "", hash = ""] = parts;
  let repositoryPath: string;
  try {
    if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(rawPath)) {
      const url = new URL(rawPath, "https://github.com");
      const githubMatch =
        url.hostname === "github.com"
          ? url.pathname.match(
              /^\/easysoft\/zentao-cli\/(?:blob|raw)\/[^/]+\/(.+)$/i,
            )
          : url.hostname === "raw.githubusercontent.com"
            ? url.pathname.match(/^\/easysoft\/zentao-cli\/[^/]+\/(.+)$/i)
            : null;
      if (!githubMatch) return href;
      repositoryPath = decodeURIComponent(githubMatch[1]);
    } else if (/^[a-z][a-z\d+.-]*:/i.test(rawPath)) {
      return href;
    } else {
      const path = decodeURIComponent(rawPath);
      repositoryPath = path.startsWith("/")
        ? posix.normalize(path.slice(1))
        : posix.normalize(posix.join(posix.dirname(sourcePath), path));
    }
  } catch {
    return href;
  }
  if (repositoryPath === "docs/command-reference.html") {
    return `command-explorer.html${query}${hash}`;
  }
  const target = sources.find(
    (document) => document.sourcePath === repositoryPath,
  );
  if (target) return `${target.fileName}${query}${hash}`;
  const encodedPath = repositoryPath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${image ? "https://raw.githubusercontent.com/easysoft/zentao-cli/main/" : repositoryUrl}${encodedPath}${query}${hash}`;
}

function preserveRawHtml(content: string): string {
  // Unknown tags are literal CLI placeholders. Keep their spelling before parsing HTML.
  return content.replace(/<\/?([a-z][\w:-]*)\b[^>]*>/gi, (tag, name: string) =>
    rawHtmlTags.has(name.toLowerCase()) ? tag : escapeHtml(tag),
  );
}

function rawText(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(?:a|br|details|summary)\b[^>]*>/gi, " ");
}

function inlineText(tokens: Token[] | null): string {
  return (tokens || [])
    .map((token) => {
      if (token.type === "softbreak" || token.type === "hardbreak") return " ";
      if (token.type === "task_checkbox")
        return token.meta?.checked ? "已完成 " : "未完成 ";
      if (token.children) return inlineText(token.children);
      if (token.type === "html_inline") return rawText(token.content);
      return token.content;
    })
    .join("");
}

function plainTokenText(token: Token): string {
  if (token.type === "inline") return inlineText(token.children);
  if (token.type === "html_block") return rawText(token.content);
  if (token.type === "fence" || token.type === "code_block")
    return token.content;
  return "";
}

function walkTokens(tokens: Token[], visit: (token: Token) => void): void {
  for (const token of tokens) {
    visit(token);
    if (token.children) walkTokens(token.children, visit);
  }
}

export function renderMarkdownDocumentation(
  source: string,
  document: DocumentationSource,
  sources: DocumentationSource[] = getDocumentationSources(),
): DocumentationPage {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  const slugger = new GithubSlugger();
  const tokens = md.parse(source, {});
  const headings: DocumentationHeading[] = [];
  const headingMetadata = new Map<Token, DocumentationHeading>();
  const explicitIds = new Set<string>();
  const admonitionLabels: Record<string, string> = {
    NOTE: "说明",
    TIP: "提示",
    IMPORTANT: "重要提示",
    WARNING: "注意",
    CAUTION: "警告",
  };
  for (let index = 2; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== "inline" || tokens[index - 1].type !== "paragraph_open")
      continue;
    if (tokens[index - 2].type === "blockquote_open") {
      const admonition = token.content.match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?=\s|$)/,
      );
      if (admonition) {
        token.content = `${admonitionLabels[admonition[1]]}：${token.content.slice(admonition[0].length)}`;
        token.children = md.parseInline(token.content, {})[0].children;
      }
    }
    if (tokens[index - 2].type !== "list_item_open") continue;
    const task = token.content.match(/^\[([ xX])\]\s+/);
    if (!task) continue;
    const checkbox = new MarkdownIt.Token("task_checkbox", "input", 0);
    checkbox.meta = { checked: task[1].toLowerCase() === "x" };
    token.content = token.content.slice(task[0].length);
    token.children = [
      checkbox,
      ...(md.parseInline(token.content, {})[0].children || []),
    ];
    tokens[index - 2].attrJoin("class", "doc-task-list-item");
  }
  walkTokens(tokens, (token) => {
    if (token.type === "html_inline" || token.type === "html_block") {
      for (const match of token.content.matchAll(
        /<a\s[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi,
      )) {
        explicitIds.add(match[1]);
        slugger.occurrences[match[1]] = 0;
      }
    }
    if (token.type === "link_open") {
      token.attrSet(
        "href",
        rewriteDocumentationLink(
          String(token.attrGet("href") || ""),
          document.sourcePath,
          sources,
        ),
      );
    }
    if (token.type === "image") {
      token.attrSet(
        "src",
        rewriteDocumentationLink(
          String(token.attrGet("src") || ""),
          document.sourcePath,
          sources,
          true,
        ),
      );
    }
  });
  let introAnchor = "";
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type !== "heading_open") continue;
    const title = inlineText(tokens[index + 1]?.children || null);
    const id = slugger.slug(title);
    const heading = { title, id, level: Number(token.tag.slice(1)) };
    token.attrSet("id", id);
    token.attrSet("aria-label", title);
    headingMetadata.set(token, heading);
    headingMetadata.set(tokens[index + 2], heading);
    if (!introAnchor && heading.level === 1) introAnchor = id;
    if (heading.level === 2 || heading.level === 3) headings.push(heading);
  }
  md.renderer.rules.html_inline = (items, index) =>
    preserveRawHtml(items[index].content);
  md.renderer.rules.html_block = md.renderer.rules.html_inline;
  md.renderer.rules.heading_close = (items, index, options, _env, renderer) => {
    const heading = headingMetadata.get(items[index]);
    const anchor = heading
      ? `<a class="doc-heading-anchor" href="#${escapeHtml(heading.id)}" aria-label="定位到${escapeHtml(heading.title)}">#</a>`
      : "";
    return `${anchor}${renderer.renderToken(items, index, options)}`;
  };
  md.renderer.rules.table_open = () => '<div class="doc-table-wrap"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";
  md.renderer.rules.task_checkbox = (items, index) =>
    `<input class="doc-task-checkbox" type="checkbox" disabled${items[index].meta?.checked ? " checked" : ""} aria-label="${items[index].meta?.checked ? "已完成" : "未完成"}"> `;
  let codeIndex = 0;
  const renderCode = (token: Token): string => {
    const language = token.info.trim().split(/\s+/)[0] || "text";
    let codeId: string;
    do {
      codeId = `doc-code-${document.fileName.replace(/\.html$/, "")}-${++codeIndex}`;
    } while (explicitIds.has(codeId));
    return `<div class="doc-code"><div class="doc-code-header"><span class="doc-code-language">${escapeHtml(language)}</span><button type="button" class="doc-copy" data-doc-copy="${escapeHtml(codeId)}" aria-label="复制代码">复制</button></div><pre><code id="${escapeHtml(codeId)}" class="language-${escapeHtml(language)}">${escapeHtml(token.content)}</code></pre></div>\n`;
  };
  md.renderer.rules.fence = (items, index) => renderCode(items[index]);
  md.renderer.rules.code_block = (items, index) => renderCode(items[index]);
  // Sanitize the complete document so details spanning multiple Markdown blocks stay intact.
  const content = sanitizeHtml(md.renderer.render(tokens, md.options, {}), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "details",
      "summary",
      "button",
      "img",
      "input",
    ],
    allowedAttributes: {
      "*": ["id", "class", "aria-label"],
      a: ["href", "id", "class", "title", "aria-label"],
      button: ["type", "class", "data-doc-copy", "aria-label"],
      img: ["src", "alt", "title", "width", "height"],
      input: ["class", "type", "disabled", "checked", "aria-label"],
      details: ["open"],
      th: ["align"],
      td: ["align"],
      ol: ["start"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "escape",
  });
  const search: DocumentationSearchEntry[] = [];
  let currentHeading = "概览";
  let currentAnchor = introAnchor;
  let textParts: string[] = [];
  const addSearchEntry = () => {
    search.push({
      title: document.title,
      heading: currentHeading,
      url: `./${document.fileName}${currentAnchor ? `#${currentAnchor}` : ""}`,
      text: md.utils
        .unescapeAll(textParts.join(" "))
        .replace(/\s+/g, " ")
        .trim(),
    });
    textParts = [];
  };
  for (const token of tokens) {
    const heading = headingMetadata.get(token);
    if (
      token.type === "heading_open" &&
      heading &&
      heading.level >= 2 &&
      heading.level <= 6
    ) {
      addSearchEntry();
      currentHeading = heading.title;
      currentAnchor = heading.id;
    }
    const text = plainTokenText(token);
    if (text) textParts.push(text);
  }
  addSearchEntry();
  const firstParagraph = tokens.find(
    (token, index) =>
      token.type === "inline" && tokens[index - 1]?.type === "paragraph_open",
  );
  const description = (
    firstParagraph
      ? inlineText(firstParagraph.children)
      : `${document.title} · ZenTao CLI 文档`
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return { ...document, description, content, headings, search };
}

export function loadDocumentation(): DocumentationPage[] {
  const sources = getDocumentationSources();
  return sources.map((document) =>
    renderMarkdownDocumentation(
      readFileSync(resolve(repositoryRoot, document.sourcePath), "utf8"),
      document,
      sources,
    ),
  );
}

export function renderDocumentationPage(
  template: string,
  page: DocumentationPage,
  pages: DocumentationPage[],
): string {
  const usageDocuments = new Set([
    "index.html",
    "use-zentao-in-agents.html",
    "cli-usage.html",
    "command-reference.html",
    "errors.html",
  ]);
  const navigationGroups = [
    {
      title: "使用指南",
      pages: pages.filter((item) => usageDocuments.has(item.fileName)),
    },
    {
      title: "项目开发",
      pages: pages.filter(
        (item) =>
          !usageDocuments.has(item.fileName) &&
          item.fileName !== "changelog.html",
      ),
    },
    {
      title: "版本记录",
      pages: pages.filter((item) => item.fileName === "changelog.html"),
    },
  ];
  const sidebar = navigationGroups
    .filter((group) => group.pages.length)
    .map(
      (group) =>
        `<p class="docs-nav-heading">${group.title}</p><ul class="docs-nav-list">${group.pages.map((item) => `<li><a class="docs-nav-link" href="${escapeHtml(item.fileName)}"${item.fileName === page.fileName ? ' aria-current="page"' : ""}>${escapeHtml(item.title)}</a></li>`).join("")}</ul>`,
    )
    .join("");
  const tocHeadings =
    page.headings.length > 40
      ? page.headings.filter((heading) => heading.level === 2)
      : page.headings;
  const toc = `<ul class="docs-toc-list">${tocHeadings.map((heading) => `<li class="docs-toc-item" data-level="${heading.level}"><a class="docs-toc-link" href="#${escapeHtml(heading.id)}" data-level="${heading.level}">${escapeHtml(heading.title)}</a></li>`).join("")}</ul>`;
  const pageIndex = pages.findIndex((item) => item.fileName === page.fileName);
  const pagination = [
    { page: pages[pageIndex - 1], rel: "prev", label: "上一页" },
    { page: pages[pageIndex + 1], rel: "next", label: "下一页" },
  ]
    .map((item) =>
      item.page
        ? `<a class="docs-page-link" href="${escapeHtml(item.page.fileName)}" rel="${item.rel}"><span>${item.label}</span><strong>${escapeHtml(item.page.title)}</strong></a>`
        : '<span class="docs-page-placeholder" aria-hidden="true"></span>',
    )
    .join("");
  return template
    .replaceAll("__DOC_TITLE__", () => escapeHtml(page.title))
    .replaceAll("__DOC_DESCRIPTION__", () => escapeHtml(page.description))
    .replace("<!-- docs-sidebar -->", () => sidebar)
    .replace("<!-- docs-toc -->", () => toc)
    .replace("<!-- docs-content -->", () => page.content)
    .replace("<!-- docs-pagination -->", () => pagination);
}

/** The template is compiled at the site root but emitted one directory deeper. */
function templateForDocsDirectory(template: string, base: string): string {
  if (base !== "./" && base !== "") return template;
  return template.replace(
    /\b(href|src)=(['"])\.\/(?=assets\/|brand\/)/g,
    "$1=$2../",
  );
}

export function documentationPlugin(): Plugin {
  let configuredBase = "./";
  return {
    name: "zentao-static-documentation",
    enforce: "post",
    configResolved(config) {
      configuredBase = config.base;
    },
    config() {
      return {
        build: {
          rolldownOptions: {
            input: {
              main: resolve(siteRoot, "index.html"),
              documentation: templatePath,
            },
          },
        },
      };
    },
    buildStart() {
      for (const document of getDocumentationSources()) {
        this.addWatchFile(resolve(repositoryRoot, document.sourcePath));
      }
      this.addWatchFile(explorerPath);
      this.addWatchFile(resolve(siteRoot, "src/explorer.css"));
    },
    configureServer(server) {
      server.watcher.add([
        resolve(repositoryRoot, "README.md"),
        resolve(repositoryRoot, "CHANGES.md"),
        docsDirectory,
        resolve(siteRoot, "src/explorer.css"),
      ]);
      const reload = (path: string) => {
        if (
          path === resolve(repositoryRoot, "README.md") ||
          path === resolve(repositoryRoot, "CHANGES.md") ||
          path === resolve(siteRoot, "src/explorer.css") ||
          (path.startsWith(`${docsDirectory}/`) && /\.(?:md|html)$/.test(path))
        ) {
          server.ws.send({ type: "full-reload", path: "*" });
        }
      };
      server.watcher
        .on("change", reload)
        .on("add", reload)
        .on("unlink", reload);
      server.httpServer?.once("close", () => {
        server.watcher
          .off("change", reload)
          .off("add", reload)
          .off("unlink", reload);
      });
      server.middlewares.use(async (request, response, next) => {
        let pathname: string;
        try {
          pathname = decodeURIComponent(
            new URL(request.url || "/", "http://localhost").pathname,
          );
        } catch {
          return next();
        }
        const base = server.config.base.replace(/\/$/, "");
        if (base && pathname.startsWith(`${base}/`))
          pathname = pathname.slice(base.length);
        if (pathname === "/docs" || pathname === "/docs/") {
          response.writeHead(302, {
            Location: `${server.config.base}docs/index.html`,
          });
          response.end();
          return;
        }
        if (!/^\/docs\/[^/]+\.(?:html|json)$/.test(pathname)) return next();
        try {
          if (pathname === "/docs/command-explorer.html") {
            response.setHeader("Content-Type", "text/html; charset=utf-8");
            response.end(
              renderCommandExplorer(
                readFileSync(explorerPath, "utf8"),
                `<link rel="stylesheet" href="${server.config.base}src/styles.css">`,
              ),
            );
            return;
          }
          const pages = loadDocumentation();
          if (pathname === "/docs/search-index.json") {
            response.setHeader(
              "Content-Type",
              "application/json; charset=utf-8",
            );
            response.end(JSON.stringify(pages.flatMap((page) => page.search)));
            return;
          }
          const page = pages.find(
            (item) => pathname === `/docs/${item.fileName}`,
          );
          if (!page) {
            response.writeHead(404, {
              "Content-Type": "text/plain; charset=utf-8",
            });
            response.end("文档不存在");
            return;
          }
          const html = renderDocumentationPage(
            readFileSync(templatePath, "utf8"),
            page,
            pages,
          );
          const transformed = await server.transformIndexHtml(
            request.url || pathname,
            html,
          );
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(transformed);
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const templateAsset = bundle["docs-template.html"];
        if (!templateAsset || templateAsset.type !== "asset") {
          throw new Error("Vite did not emit the documentation HTML template.");
        }
        const compiledTemplate =
          typeof templateAsset.source === "string"
            ? templateAsset.source
            : new TextDecoder().decode(templateAsset.source);
        const template = templateForDocsDirectory(
          compiledTemplate,
          configuredBase,
        );
        const pages = loadDocumentation();
        for (const page of pages) {
          this.emitFile({
            type: "asset",
            fileName: `docs/${page.fileName}`,
            source: renderDocumentationPage(template, page, pages),
          });
        }
        this.emitFile({
          type: "asset",
          fileName: "docs/search-index.json",
          source: JSON.stringify(pages.flatMap((page) => page.search)),
        });
        // The homepage links the shared stylesheet without docs-only CSS.
        const homepage = bundle["index.html"];
        if (!homepage || homepage.type !== "asset") {
          throw new Error("Vite did not emit the homepage HTML template.");
        }
        const homepageHtml =
          typeof homepage.source === "string"
            ? homepage.source
            : new TextDecoder().decode(homepage.source);
        const stylesheetLinks = homepageHtml.match(
          /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/g,
        );
        if (!stylesheetLinks?.length) {
          throw new Error("Vite did not emit the shared site stylesheet.");
        }
        this.emitFile({
          type: "asset",
          fileName: "docs/command-explorer.html",
          source: renderCommandExplorer(
            readFileSync(explorerPath, "utf8"),
            templateForDocsDirectory(stylesheetLinks.join("\n"), configuredBase),
          ),
        });
        delete bundle["docs-template.html"];
      },
    },
  };
}
