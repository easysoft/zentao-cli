import arrowRight from "@phosphor-icons/core/regular/arrow-right.svg?raw";
import arrowUpRight from "@phosphor-icons/core/regular/arrow-up-right.svg?raw";
import bookOpen from "@phosphor-icons/core/regular/book-open.svg?raw";
import bracketsCurly from "@phosphor-icons/core/regular/brackets-curly.svg?raw";
import chatCircleText from "@phosphor-icons/core/regular/chat-circle-text.svg?raw";
import check from "@phosphor-icons/core/regular/check.svg?raw";
import copy from "@phosphor-icons/core/regular/copy.svg?raw";
import fileText from "@phosphor-icons/core/regular/file-text.svg?raw";
import funnelSimple from "@phosphor-icons/core/regular/funnel-simple.svg?raw";
import githubLogo from "@phosphor-icons/core/regular/github-logo.svg?raw";
import list from "@phosphor-icons/core/regular/list.svg?raw";
import moon from "@phosphor-icons/core/regular/moon.svg?raw";
import plugsConnected from "@phosphor-icons/core/regular/plugs-connected.svg?raw";
import plus from "@phosphor-icons/core/regular/plus.svg?raw";
import shieldCheck from "@phosphor-icons/core/regular/shield-check.svg?raw";
import sparkle from "@phosphor-icons/core/regular/sparkle.svg?raw";
import squaresFour from "@phosphor-icons/core/regular/squares-four.svg?raw";
import sun from "@phosphor-icons/core/regular/sun.svg?raw";
import terminalWindow from "@phosphor-icons/core/regular/terminal-window.svg?raw";
import userSwitch from "@phosphor-icons/core/regular/user-switch.svg?raw";
import x from "@phosphor-icons/core/regular/x.svg?raw";

const icons: Record<string, string> = {
  "arrow-right": arrowRight,
  "arrow-up-right": arrowUpRight,
  "book-open": bookOpen,
  "brackets-curly": bracketsCurly,
  "chat-circle-text": chatCircleText,
  check,
  copy,
  "file-text": fileText,
  "funnel-simple": funnelSimple,
  "github-logo": githubLogo,
  list,
  moon,
  "plugs-connected": plugsConnected,
  plus,
  "shield-check": shieldCheck,
  sparkle,
  "squares-four": squaresFour,
  sun,
  "terminal-window": terminalWindow,
  "user-switch": userSwitch,
  x,
};

function setIcon(element: HTMLElement, name: string) {
  element.innerHTML = icons[name] ?? "";
  element.setAttribute("aria-hidden", "true");
  element.querySelector("svg")?.setAttribute("focusable", "false");
}

document.querySelectorAll<HTMLElement>("[data-icon]").forEach((element) => {
  setIcon(element, element.dataset.icon!);
});

const toast = document.getElementById("copy-status")!;
let toastTimer: ReturnType<typeof setTimeout>;
export function showStatus(message: string) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 4500);
}

export async function copyCommand(
  value: string,
  button: HTMLButtonElement,
  { multiline = false, message = "命令已复制" } = {},
) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    if (!navigator.clipboard?.writeText)
      throw new Error("Clipboard unavailable");
    // Normalize wrapped shell commands, but preserve configuration indentation.
    const command = multiline
      ? value.trim()
      : value.replace(/\s*[\r\n]+\s*/g, " ").trim();
    await navigator.clipboard.writeText(command);
    const icon = button.querySelector<HTMLElement>("[data-icon]");
    if (icon) {
      setIcon(icon, "check");
      setTimeout(() => setIcon(icon, "copy"), 1800);
    }
    showStatus(message);
  } catch {
    showStatus("未能复制，请选中文本手动复制。");
  } finally {
    button.disabled = false;
  }
}

const themeToggle = document.querySelector<HTMLButtonElement>(".theme-toggle")!;
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let manualTheme = false;
try {
  manualTheme = ["light", "dark"].includes(
    localStorage.getItem("zentao-site-theme") ?? "",
  );
} catch {
  /* Storage is optional. */
}
function syncThemeButton() {
  const isDark = document.documentElement.dataset.theme === "dark";
  const label = isDark ? "切换浅色模式" : "切换深色模式";
  themeToggle.setAttribute("aria-label", label);
  themeToggle.title = label;
  setIcon(
    themeToggle.querySelector<HTMLElement>("[data-icon]")!,
    isDark ? "sun" : "moon",
  );
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#0f1b29" : "#f6f8fa");
}
themeToggle.hidden = false;
syncThemeButton();
themeToggle.addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  manualTheme = true;
  try {
    localStorage.setItem("zentao-site-theme", theme);
  } catch {
    /* The in-memory choice still works. */
  }
  syncThemeButton();
});
systemTheme.addEventListener("change", (event) => {
  if (manualTheme) return;
  document.documentElement.dataset.theme = event.matches ? "dark" : "light";
  syncThemeButton();
});

const navigation = document.getElementById("navigation")!;
const menuToggle = document.querySelector<HTMLButtonElement>(".menu-toggle")!;
menuToggle.hidden = false;
function setMenu(open: boolean, restoreFocus = false) {
  navigation.classList.toggle("is-open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
  setIcon(
    menuToggle.querySelector<HTMLElement>("[data-icon]")!,
    open ? "x" : "list",
  );
  if (restoreFocus) menuToggle.focus();
}
menuToggle.addEventListener("click", (event) => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  setMenu(open);
  if (open && event.detail === 0) navigation.querySelector("a")?.focus();
});
navigation
  .querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menuToggle.getAttribute("aria-expanded") === "true"
  )
    setMenu(false, true);
});
document.addEventListener("click", (event) => {
  // Icon replacement can detach the clicked SVG before this listener runs.
  const path = event.composedPath();
  if (!path.includes(navigation) && !path.includes(menuToggle)) setMenu(false);
});
matchMedia("(min-width: 768px)").addEventListener("change", () =>
  setMenu(false),
);
document.documentElement.classList.add("js-ready");
