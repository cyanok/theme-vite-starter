import { fileURLToPath } from "node:url";

import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";
import { defineConfig } from "vite-plus";

export default defineConfig({
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    haloThemePlugin(),
    {
      name: "validate-halo-templates",
      transformIndexHtml: {
        order: "post",
        handler(html, context) {
          if (/<!--\s*Partial error:/i.test(html)) {
            throw new Error(`Template compilation failed: ${context.filename}`);
          }
          return html;
        },
      },
    },
  ],
  lint: { options: { typeAware: true, typeCheck: true }, ignorePatterns: [".agents"] },
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    sortPackageJson: true,
    insertFinalNewline: true,
    sortImports: {},
    sortTailwindcss: {},
    ignorePatterns: [".agents"],
  },
  staged: {
    "*": ["vp check --no-error-on-unmatched-pattern"],
  },
});
