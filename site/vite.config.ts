import { defineConfig } from "vite";
import { renderAgentGuides } from "./guide-renderer.ts";
import { documentationPlugin } from "./docs-generator.js";

export default defineConfig({
  base: process.env.BASE_PATH || "./",
  plugins: [
    {
      name: "agent-integration-guides",
      transformIndexHtml(html) {
        return html.includes("<!-- agent-guides -->")
          ? html.replace("<!-- agent-guides -->", renderAgentGuides())
          : html;
      },
    },
    documentationPlugin(),
  ],
});
