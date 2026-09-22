import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseHtml, parseFragment } from "parse5";
import { parse } from "yaml";

const templatesDirectory = new URL("../templates/", import.meta.url);
const templatesPath = fileURLToPath(templatesDirectory);
const theme = parse(await readFile(new URL("../theme.yaml", import.meta.url), "utf8"));
if (typeof theme?.metadata?.name !== "string" || !theme.metadata.name.trim()) {
  throw new Error("theme.yaml is missing metadata.name");
}
const themeBase = new URL(`/themes/${theme.metadata.name}/`, "https://theme.invalid");
// 与 Halo 插件一致：src 下的 HTML 都是入口，任意层级的 partials 目录除外。
const sourcePath = fileURLToPath(new URL("../src/", import.meta.url));
const sourceNames = (await readdir(sourcePath, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => relative(sourcePath, resolve(entry.parentPath, entry.name)).replaceAll("\\", "/"))
  .filter((name) => name.endsWith(".html") && !name.split("/").includes("partials"));
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

function attribute(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

function expression(node, name) {
  return (attribute(node, `th:${name}`) ?? attribute(node, `data-th-${name}`))?.replace(/\s+/g, "");
}

function inserts(node, parameter) {
  return ["replace", "insert"].some((name) => expression(node, name) === `\${${parameter}}`);
}

function assertLayoutContract(document) {
  const nodes = [...elements(document)];
  // 参数顺序属于契约；括号、逗号周围的空白和 HTML 引号风格不属于契约。
  const fragment = nodes.find(
    (node) =>
      node.tagName === "html" &&
      /^\s*html\s*\(\s*head\s*,\s*content\s*\)\s*$/.test(attribute(node, "th:fragment")),
  );
  if (!fragment) throw new Error("templates/layout.html is missing html(head, content) fragment");
  const fragmentNodes = [...elements(fragment)];
  if (!fragmentNodes.some((node) => inserts(node, "head"))) {
    throw new Error("templates/layout.html is missing head insertion");
  }
  if (!fragmentNodes.some((node) => inserts(node, "content"))) {
    throw new Error("templates/layout.html is missing content insertion");
  }
}

for (const sourceName of new Set(["index.html", ...sourceNames])) {
  await assertFileExists(sourceName);
}

const templateNames = (await readdir(templatesDirectory, { recursive: true })).filter((name) =>
  name.endsWith(".html"),
);
for (const templateName of templateNames) {
  const page = await readFile(
    new URL(templateName.replaceAll("\\", "/"), templatesDirectory),
    "utf8",
  );
  const document = parseFragment(page);
  if ([...elements(document)].some((node) => node.tagName === "include")) {
    throw new Error(`templates/${templateName} contains an unprocessed include tag`);
  }
  if (/<!--\s*Partial error:/i.test(page)) {
    throw new Error(`templates/${templateName} contains a template compilation error`);
  }
  if (templateName === "layout.html") assertLayoutContract(parseHtml(page));
  for (const element of elements(document)) {
    if (!resourceElements.has(element.tagName)) continue;
    const attributes = new Map(element.attrs.map(({ name, value }) => [name, value]));
    for (const name of ["src", "href"]) {
      if (attributes.has(`th:${name}`) || attributes.has(`data-th-${name}`)) continue;
      const reference = attributes.get(name);
      // 页面 URL 由 Halo 路由决定，不能从模板路径推断相对资源地址。
      if (
        !reference?.startsWith(`${themeBase.pathname}assets/`) ||
        /[{}]|\[\[|\[\(/.test(reference)
      ) {
        continue;
      }
      const resourceUrl = new URL(reference, themeBase);
      const resourcePath = decodeURIComponent(
        resourceUrl.pathname.slice(themeBase.pathname.length),
      );
      await assertFileExists(resourcePath, templateName);
    }
  }
}

console.log(
  `Verified ${sourceNames.length} source template outputs, ${templateNames.length} HTML templates, and theme assets (including the page-layout contract when provided).`,
);
