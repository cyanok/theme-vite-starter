import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parseFragment } from "parse5";
import { parse } from "yaml";

const templatesDirectory = new URL("../templates/", import.meta.url);
const templatesPath = fileURLToPath(templatesDirectory);
const theme = parse(await readFile(new URL("../theme.yaml", import.meta.url), "utf8"));
if (typeof theme?.metadata?.name !== "string" || !theme.metadata.name.trim()) {
  throw new Error("theme.yaml is missing metadata.name");
}
const themeBase = new URL(`/themes/${theme.metadata.name}/`, "https://theme.invalid");
const pageNames = [
  "index.html",
  "post.html",
  "page.html",
  "archives.html",
  "tags.html",
  "tag.html",
  "categories.html",
  "category.html",
];
const moduleNames = ["modules/menu-tree.html", "modules/category-tree.html"];
const resourceElements = new Set([
  "script",
  "link",
  "img",
  "source",
  "video",
  "audio",
  "iframe",
  "input",
  "embed",
]);

const requiredLayoutContent = [
  'th:fragment="html (head, content)"',
  'th:if="${head != null}"',
  'th:replace="${head}"',
  'th:replace="${content}"',
  "<halo:footer />",
];

async function assertFileExists(fileName, referencedBy) {
  const outputPath = resolve(templatesPath, fileName);
  const relativePath = relative(templatesPath, outputPath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`Invalid build output path: ${fileName}`);
  }
  try {
    if (!(await stat(outputPath)).isFile()) throw new Error("Not a file");
  } catch {
    const reference = referencedBy ? ` (referenced by templates/${referencedBy})` : "";
    throw new Error(`Missing build output: templates/${fileName}${reference}`);
  }
}

function* elements(node) {
  if (node.tagName) yield node;
  for (const child of node.childNodes ?? []) yield* elements(child);
  if (node.content) yield* elements(node.content);
}

for (const pageName of [...pageNames, ...moduleNames]) {
  await assertFileExists(pageName);
}
await assertFileExists("layout.html");

const layout = await readFile(new URL("layout.html", templatesDirectory), "utf8");
for (const expectedContent of requiredLayoutContent) {
  if (!layout.includes(expectedContent)) {
    throw new Error(`templates/layout.html is missing: ${expectedContent}`);
  }
}

const templateNames = (await readdir(templatesDirectory, { recursive: true })).filter((name) =>
  name.endsWith(".html"),
);
for (const templateName of templateNames) {
  const page = await readFile(
    new URL(templateName.replaceAll("\\", "/"), templatesDirectory),
    "utf8",
  );
  if (/<\/?(?:include|slot)(?:\s|\/?>)/i.test(page)) {
    throw new Error(`templates/${templateName} contains an unprocessed include or slot tag`);
  }
  if (/<!--\s*Partial error:/i.test(page)) {
    throw new Error(`templates/${templateName} contains a template compilation error`);
  }
  const templateUrl = new URL(templateName.replaceAll("\\", "/"), themeBase);
  for (const element of elements(parseFragment(page))) {
    if (!resourceElements.has(element.tagName)) continue;
    const attributes = new Map(element.attrs.map(({ name, value }) => [name, value]));
    for (const name of ["src", "href"]) {
      if (attributes.has(`th:${name}`) || attributes.has(`data-th-${name}`)) continue;
      const reference = attributes.get(name);
      // 动态 Thymeleaf 表达式由 Halo 解析；这里只验证本主题的静态资源。
      if (!reference || reference.startsWith("#") || /[{}]|\[\[|\[\(/.test(reference)) continue;
      const resourceUrl = new URL(reference, templateUrl);
      if (
        resourceUrl.origin !== themeBase.origin ||
        !resourceUrl.pathname.startsWith(themeBase.pathname)
      ) {
        continue;
      }
      const resourcePath = decodeURIComponent(
        resourceUrl.pathname.slice(themeBase.pathname.length),
      );
      await assertFileExists(resourcePath, templateName);
    }
  }
}

const assetsDirectory = new URL("assets/", templatesDirectory);
let assetNames;
try {
  assetNames = await readdir(assetsDirectory, { recursive: true });
} catch {
  throw new Error("Missing build output directory: templates/assets/");
}

for (const extension of [".css", ".js"]) {
  if (!assetNames.some((assetName) => assetName.endsWith(extension))) {
    throw new Error(`templates/assets/ contains no ${extension} build output`);
  }
}

console.log(
  `Verified ${pageNames.length} theme pages, ${moduleNames.length} runtime modules, ${templateNames.length} HTML templates, the Halo page-layout contract, and static resource references in ${join("templates", "assets")}.`,
);
