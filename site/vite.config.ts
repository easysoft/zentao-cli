import { brandDocument, loadBrand } from '../scripts/brand-config.js';
const selectedBrand = loadBrand(process.env.CLI_BRAND_FILE);
import { defineConfig } from "vite";
import { renderAgentGuides } from "./guide-renderer.ts";
import { documentationPlugin } from "./docs-generator.js";

export default defineConfig({
  publicDir: process.env.CLI_PUBLIC_DIR,
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
    {
      name: 'product-brand',
      enforce: 'post',
      renderChunk(code, chunk) {
        return selectedBrand ? { code: brandDocument(code, selectedBrand, chunk.fileName), map: null } : null;
      },
      generateBundle: { order: 'post', handler(_, bundle) {
        if (!selectedBrand) return;
        for (const item of Object.values(bundle)) {
          if (item.type === 'asset' && /\.(?:html|json)$/.test(item.fileName) && typeof item.source === 'string') item.source = brandDocument(item.source, selectedBrand, item.fileName);
        }
      } },
    },
  ],
});
