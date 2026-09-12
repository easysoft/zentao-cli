import { copyCommand } from "./ui.js";

// One keyboard and selection contract for every tab group.
document
  .querySelectorAll<HTMLElement>('[role="tablist"]')
  .forEach((tablist) => {
    const tabs = Array.from(
      tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const activate = (tab: HTMLButtonElement) => {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
        const panel = document.getElementById(
          item.getAttribute("aria-controls")!,
        );
        if (panel) panel.hidden = !selected;
      });
      if (tab.dataset.install) updateStartCommands(tab.dataset.install);
      if (tab.dataset.format) updateOutputCommand();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        let next: number;
        const vertical =
          tablist.getAttribute("aria-orientation") === "vertical";
        if (event.key === (vertical ? "ArrowDown" : "ArrowRight"))
          next = (index + 1) % tabs.length;
        else if (event.key === (vertical ? "ArrowUp" : "ArrowLeft"))
          next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        const target = tabs[next]!;
        target.focus();
        activate(target);
      });
    });
  });

function updateStartCommands(method: string) {
  const executable = method === "npx" ? "npx zentao-cli" : "zentao";
  document.getElementById("login-command")!.textContent = `${executable} login`;
  document.getElementById("product-command")!.textContent =
    `${executable} product`;
  document.querySelectorAll(".terminal-command code").forEach((code) => {
    code.textContent = code.textContent!.replace(
      /^(?:npx zentao-cli|zentao)(?= )/,
      executable,
    );
  });
  updateOutputCommand();
}

function updateOutputCommand() {
  const method = document.querySelector<HTMLButtonElement>(
    '[data-install][aria-selected="true"]',
  )!.dataset.install;
  const format = document.querySelector<HTMLButtonElement>(
    '[data-format][aria-selected="true"]',
  )!.dataset.format;
  const executable = method === "npx" ? "npx zentao-cli" : "zentao";
  document.getElementById("output-command")!.textContent =
    `${executable} product --pick=id,name --format=${format === "md" ? "markdown" : "json"}`;
}

document
  .querySelectorAll<HTMLButtonElement>("[data-copy]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => void copyCommand(button.dataset.copy!, button),
    );
  });
const copyDemo = document.querySelector<HTMLButtonElement>("[data-copy-demo]")!;
copyDemo.addEventListener("click", () => {
  const active = document.querySelector(
    ".demo-panel:not([hidden]) .terminal-command code",
  )!;
  void copyCommand(active.textContent!, copyDemo);
});
const copyOutput =
  document.querySelector<HTMLButtonElement>("[data-copy-output]")!;
copyOutput.addEventListener("click", () => {
  void copyCommand(
    document.getElementById("output-command")!.textContent!,
    copyOutput,
  );
});
document
  .querySelectorAll<HTMLButtonElement>("[data-copy-target]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.getElementById(button.dataset.copyTarget!);
      if (!target) return;
      const multiline = button.hasAttribute("data-copy-multiline");
      void copyCommand(target.textContent!, button, {
        multiline,
        message:
          button.dataset.copyMessage ??
          (multiline ? "配置已复制" : "命令已复制"),
      });
    });
  });
for (const name of ["login", "product"]) {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-copy-${name}]`,
  )!;
  button.addEventListener(
    "click",
    () =>
      void copyCommand(
        document.getElementById(`${name}-command`)!.textContent!,
        button,
      ),
  );
}
