import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const templatesDirectory = new URL("../templates/", import.meta.url);
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

const requiredLayoutContent = [
  'th:fragment="html (head, content)"',
  'th:if="${head != null}"',
  'th:replace="${head}"',
  'th:replace="${content}"',
  "<halo:footer />",
];

async function assertFileExists(fileName) {
  try {
    await access(new URL(fileName, templatesDirectory));
  } catch {
    throw new Error(`Missing build output: templates/${fileName}`);
  }
}

for (const pageName of pageNames) {
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
  `Verified ${pageNames.length} theme pages, ${templateNames.length} HTML templates, the Halo page-layout contract, and built assets in ${join("templates", "assets")}.`,
);
