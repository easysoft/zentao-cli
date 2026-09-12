import { copyCommand } from "./ui.js";

document
  .querySelectorAll<HTMLButtonElement>("[data-doc-copy]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const code = document.getElementById(button.dataset.docCopy!);
      if (code)
        void copyCommand(code.textContent!, button, {
          multiline: true,
          message: "代码已复制",
        });
    });
  });

// Native details keep both navigation lists available without JavaScript.
const compact = matchMedia("(max-width: 1100px)");
const mobile = matchMedia("(max-width: 767px)");
const navigation =
  document.querySelector<HTMLDetailsElement>("#docs-navigation")!;
const toc = document.querySelector<HTMLDetailsElement>("#docs-toc-details")!;
function adaptNavigation() {
  navigation.open = !mobile.matches;
  toc.open = !compact.matches;
}
adaptNavigation();
compact.addEventListener("change", adaptNavigation);
mobile.addEventListener("change", adaptNavigation);

// Reveal folded examples when arriving at a heading from a deep link or search.
function revealAnchor() {
  let anchor = "";
  try {
    anchor = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = anchor ? document.getElementById(anchor) : null;
  if (!target) return;
  let parent = target.parentElement;
  let revealed = false;
  while (parent) {
    if (parent instanceof HTMLDetailsElement && !parent.open) {
      parent.open = true;
      revealed = true;
    }
    parent = parent.parentElement;
  }
  if (revealed) target.scrollIntoView({ block: "start" });
}
revealAnchor();
window.addEventListener("hashchange", revealAnchor);

type SearchEntry = {
  title: string;
  heading: string;
  url: string;
  text: string;
};
const input = document.querySelector<HTMLInputElement>("#docs-search")!;
const results = document.querySelector<HTMLUListElement>(
  "#docs-search-results",
)!;
const status = document.getElementById("docs-search-status")!;
const panel = document.getElementById("docs-search-panel")!;
const close = document.querySelector<HTMLButtonElement>("#docs-search-close")!;
let indexPromise: Promise<SearchEntry[]> | undefined;
let queryGeneration = 0;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch("./search-index.json")
      .then((response) => {
        if (!response.ok) throw new Error("Search unavailable");
        return response.json() as Promise<SearchEntry[]>;
      })
      .catch((error) => {
        indexPromise = undefined;
        throw error;
      });
  }
  return indexPromise;
}

function closeSearch() {
  queryGeneration++;
  panel.hidden = true;
  close.hidden = true;
}

async function search() {
  const generation = ++queryGeneration;
  const query = input.value.trim().toLocaleLowerCase();
  if (!query) {
    closeSearch();
    return;
  }
  panel.hidden = false;
  close.hidden = false;
  status.textContent = "正在搜索…";
  results.replaceChildren();
  try {
    const entries = await loadIndex();
    if (generation !== queryGeneration) return;
    const terms = query.split(/\s+/).filter(Boolean);
    const matches = entries
      .map((entry) => {
        const heading = `${entry.title} ${entry.heading}`.toLocaleLowerCase();
        const haystack = `${heading} ${entry.text}`.toLocaleLowerCase();
        return {
          entry,
          matches: terms.every((term) => haystack.includes(term)),
          score: terms.reduce(
            (score, term) => score + (heading.includes(term) ? 2 : 0),
            0,
          ),
        };
      })
      .filter((item) => item.matches)
      .sort((a, b) => b.score - a.score);
    status.textContent = matches.length
      ? `找到 ${matches.length} 个相关章节${matches.length > 12 ? "，显示前 12 项" : ""}`
      : "没有找到相关内容，试试命令名称或其他关键词。";
    for (const { entry } of matches.slice(0, 12)) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = entry.url;
      const title = document.createElement("strong");
      title.textContent = entry.heading || entry.title;
      const context = document.createElement("span");
      context.textContent = entry.title;
      const excerpt = document.createElement("p");
      const firstMatch = entry.text.toLocaleLowerCase().indexOf(terms[0]!);
      const start = Math.max(0, firstMatch - 26);
      excerpt.textContent = `${start ? "…" : ""}${entry.text.slice(start, start + 110)}${entry.text.length > start + 110 ? "…" : ""}`;
      link.append(context, title, excerpt);
      link.addEventListener("click", closeSearch);
      item.append(link);
      results.append(item);
    }
  } catch {
    if (generation === queryGeneration)
      status.textContent =
        "搜索暂时不可用。请使用下方目录，或重新输入关键词重试。";
  }
}

input.addEventListener("input", () => void search());
input.addEventListener("focus", () => {
  if (input.value.trim()) void search();
});
input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    const first = results.querySelector("a");
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
});
results.addEventListener("keydown", (event) => {
  const links = Array.from(results.querySelectorAll("a"));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (event.key === "ArrowUp" && current <= 0) input.focus();
    else
      links[
        Math.max(
          0,
          Math.min(
            links.length - 1,
            current + (event.key === "ArrowDown" ? 1 : -1),
          ),
        )
      ]?.focus();
  }
});
close.addEventListener("click", () => {
  input.value = "";
  input.focus();
  closeSearch();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !panel.hidden) {
    input.focus();
    closeSearch();
  }
});
document.addEventListener("click", (event) => {
  if (
    event.target instanceof Node &&
    !document.querySelector(".docs-search")!.contains(event.target)
  )
    closeSearch();
});

// Keep the current section visible in the reading outline without changing history.
const headings = Array.from(
  document.querySelectorAll<HTMLElement>(
    ".doc-prose h2[id], .doc-prose h3[id]",
  ),
);
const tocLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>(".docs-toc-link"),
);
let scheduled = false;
function updateOutline() {
  const current = headings
    .filter((heading) => heading.getBoundingClientRect().top <= 145)
    .at(-1);
  for (const link of tocLinks) {
    let anchor = "";
    try {
      anchor = decodeURIComponent(link.hash.slice(1));
    } catch {
      /* Ignore invalid fragments. */
    }
    if (anchor === current?.id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
  scheduled = false;
}
window.addEventListener(
  "scroll",
  () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(updateOutline);
    }
  },
  { passive: true },
);
updateOutline();
