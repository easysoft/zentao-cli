import { readFileSync } from "node:fs";

const sourceUrl = "https://zentao-cli.invalid/docs/command-reference.html";
const explorerStylePath = new URL("./src/explorer.css", import.meta.url);

function siteDocumentationLink(href: string): string {
  if (href.startsWith("#")) return href;

  let url: URL;
  try {
    url = new URL(href, sourceUrl);
  } catch {
    return href;
  }

  let path: string;
  if (url.origin === new URL(sourceUrl).origin) {
    path = url.pathname;
  } else if (url.origin === "https://github.com") {
    const match = url.pathname.match(
      /^\/easysoft\/zentao-cli\/blob\/(?:main|master)\/(.+)$/,
    );
    if (!match) return href;
    path = `/${match[1]}`;
  } else {
    return href;
  }

  const markdown = path.match(/^\/docs\/([a-z0-9-]+)\.md$/i);
  const page =
    path === "/README.md"
      ? "index.html"
      : path === "/CHANGES.md"
        ? "changelog.html"
        : path === "/docs/command-reference.html"
          ? "command-explorer.html"
          : markdown
            ? `${markdown[1]}.html`
            : undefined;
  return page ? `./${page}${url.search}${url.hash}` : href;
}

function rewriteDocumentationLinks(html: string): string {
  return html.replace(/<a\b[^>]*>/gi, (tag) =>
    tag.replace(/\bhref\s*=\s*(["'])(.*?)\1/i, (attribute, quote, href) => {
      const rewritten = siteDocumentationLink(href);
      return rewritten === href
        ? attribute
        : `href=${quote}${rewritten}${quote}`;
    }),
  );
}

/** Adapt the self-contained reference reader without replacing its search UI. */
export function renderCommandExplorer(
  source: string,
  stylesheetLinks: string,
): string {
  let html = source.replace(
    /(<script\b[^>]*\bid="reference-data"[^>]*>)([\s\S]*?)(<\/script>)/i,
    (_match, opening, json, closing) => {
      const data = JSON.parse(json) as { entries: { html: string }[] };
      for (const entry of data.entries) {
        entry.html = rewriteDocumentationLinks(entry.html);
      }
      // Keep embedded HTML inert until the reader deliberately renders an entry.
      return `${opening}${JSON.stringify(data).replace(/</g, "\\u003c")}${closing}`;
    },
  );

  html = rewriteDocumentationLinks(html);
  html = html.replace(
    /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,
    (match, opening, script, closing) => {
      if (/\btype=["']application\/json["']/i.test(opening)) return match;
      const updated = script.replace(
        /(localStorage\.(?:getItem|setItem)\(\s*)(["'])zentao-reference-theme\2/g,
        "$1$2zentao-site-theme$2",
      );
      return `${opening}${updated}${closing}`;
    },
  );

  html = html.replace(
    /<div class="brand">[\s\S]*?<\/div>/,
    `<div class="site-brand"><a class="wordmark" href="../index.html" aria-label="ZenTao CLI 首页"><img class="brand-light" src="../brand/pixel-tao-terminal-blue-flat.svg" alt="" width="32" height="32"><img class="brand-dark" src="../brand/pixel-tao-reverse.svg" alt="" width="32" height="32"><span>ZenTao <strong>CLI</strong></span></a><nav class="site-links" aria-label="网站导航"><a href="./command-reference.html">返回文档</a><a href="../index.html">网站首页</a></nav></div>`,
  );
  // Keep the reference reader's layout and behavior, with the site as token owner.
  html = html.replace(/<style>([\s\S]*?)<\/style>/, (_match, css: string) => {
    const layout = css.replace(/:root(?:\[data-theme="dark"\])?\s*\{[^}]*\}/g, "");
    return `${stylesheetLinks}\n<style>${layout}\n${readFileSync(explorerStylePath, "utf8")}</style>`;
  });
  html = html.replace("<body ", '<body class="explorer-page" ');
  html = html.replace(
    "</title>",
    `</title><link rel="icon" type="image/png" href="../brand/favicon.png"><script>
      try {
        const saved = localStorage.getItem("zentao-site-theme");
        document.documentElement.dataset.theme = saved === "light" || saved === "dark"
          ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch {
        document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    </script>`,
  );
  html = html.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    '<noscript>交互筛选需要 JavaScript。请阅读<a href="./command-reference.html">完整命令文档</a>。</noscript>',
  );

  return html;
}
