import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { haloThemePlugin } from "@halo-dev/vite-plugin-halo-theme";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

await test("原生空元素保留相邻内容，并保持自闭合自定义标签兼容", () => {
  const plugin = haloThemePlugin();
  for (const tag of [
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
    "BR",
    'input type="search" name="q"',
    'img alt="a > b"',
    "br /",
    "halo:footer /",
  ]) {
    const html = `<section><p>BEFORE<${tag}>AFTER</p><aside>END</aside></section>`;
    assert.equal(
      plugin.transformIndexHtml.handler(html, { filename: join(projectRoot, "src/index.html") }),
      html,
    );
  }
});

await test("主题开发监听与构建错误检查", { timeout: 60_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "halo-theme-build-"));
  let child;
  let closed;
  t.after(async () => {
    if (child) {
      child.kill("SIGTERM");
      await closed;
    }
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "scripts"));
  for (const name of ["dev.mjs", "verify-build.mjs"]) {
    await cp(join(projectRoot, "scripts", name), join(directory, "scripts", name));
  }
  await symlink(join(projectRoot, "node_modules"), join(directory, "node_modules"), "junction");

  // 构建机制使用独立夹具；实际主题的源码和 public 由 pnpm build 验证。
  const fixtureFiles = {
    "package.json": '{"private":true,"type":"module"}\n',
    "theme.yaml": "metadata:\n  name: theme-build-test\n",
    "vite.config.ts": `import config from ${JSON.stringify(join(projectRoot, "vite.config.ts").replaceAll("\\", "/"))};
import { mergeConfig } from "vite-plus";
export default mergeConfig(config, { envDir: import.meta.dirname, plugins: [] });
`,
    "src/index.html": '<include src="fixture.html"><p>BUILD_CONTENT</p></include>\n',
    "src/partials/fixture.html": `<!doctype html>
<html><head><title>Build fixture</title><script type="module" src="/assets/js/probe.ts"></script></head>
<body><section data-watch="initial"><slot /></section></body></html>
`,
    "src/layout.html": `<!doctype html>
<html th:fragment="html (head, content)"><head>
<th:block th:if="\${head != null}"><th:block th:replace="\${head}" /></th:block>
<script type="module" src="/assets/js/probe.ts"></script></head>
<body><section><th:block th:replace="\${content}" /></section><halo:footer /></body></html>
`,
    "src/modules/navigation.html": '<nav th:fragment="navigation">Fixture navigation</nav>\n',
    "src/assets/js/probe.ts":
      'import "../css/probe.css";\ndocument.documentElement.dataset.build = "fixture";\n',
    "src/assets/css/probe.css": "body { color: #333; }\n",
  };
  for (const [path, content] of Object.entries(fixtureFiles)) {
    await mkdir(dirname(join(directory, path)), { recursive: true });
    await writeFile(join(directory, path), content);
  }

  const initialConfig = await readFile(join(directory, "vite.config.ts"), "utf8");
  await mkdir(join(directory, "initial-config"));
  await writeFile(join(directory, "initial-config/probe.ts"), "export const marker = ;\n");
  await writeFile(
    join(directory, "vite.config.ts"),
    'import "./initial-config/probe";\n' + initialConfig,
  );

  child = spawn(process.execPath, ["scripts/dev.mjs"], {
    cwd: directory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  closed = once(child, "close");
  let output = "";
  child.stdout.on("data", (data) => (output += data));
  child.stderr.on("data", (data) => (output += data));

  const builds = () => output.match(/主题构建完成/g)?.length ?? 0;
  const failures = () => output.match(/主题构建失败/g)?.length ?? 0;
  const read = (path) => readFile(join(directory, path), "utf8");
  async function exists(path) {
    try {
      await access(join(directory, path));
      return true;
    } catch {
      return false;
    }
  }
  async function waitFor(predicate) {
    const deadline = Date.now() + 10_000;
    while (!(await predicate())) {
      assert.equal(child.exitCode, null, output);
      assert.ok(Date.now() < deadline, output.slice(-5000));
      await delay(50);
    }
  }
  async function change(action, predicate) {
    const previousBuilds = builds();
    await action();
    await waitFor(async () => builds() > previousBuilds && (await predicate()));
  }

  await t.test("启动时配置依赖解析失败后，单独修正依赖即可恢复", async () => {
    await waitFor(() => failures() > 0);
    await change(
      () => writeFile(join(directory, "initial-config/probe.ts"), "export {};\n"),
      () => exists("templates/index.html"),
    );
    await change(
      () => writeFile(join(directory, "vite.config.ts"), initialConfig),
      () => exists("templates/index.html"),
    );
    await rm(join(directory, "initial-config"), { recursive: true });
  });

  await t.test("片段修改以及嵌套页面增删自动生效", async () => {
    const layout = await read("src/partials/fixture.html");
    await change(
      () =>
        writeFile(
          join(directory, "src/partials/fixture.html"),
          layout.replace('data-watch="initial"', 'data-watch="updated"'),
        ),
      async () => (await read("templates/index.html")).includes('data-watch="updated"'),
    );

    await mkdir(join(directory, "src/error"));
    await change(
      () =>
        writeFile(
          join(directory, "src/error/404.html"),
          '<include src="fixture.html"><p>Nested page</p></include>',
        ),
      () => exists("templates/error/404.html"),
    );
    assert.match(await read("templates/error/404.html"), /data-watch="updated"/);
    await change(
      () => rm(join(directory, "src/error"), { recursive: true }),
      async () => !(await exists("templates/error/404.html")),
    );
    await change(
      () => writeFile(join(directory, "src/partials/fixture.html"), layout),
      async () => (await read("templates/index.html")).includes('data-watch="initial"'),
    );
  });

  await t.test("public 首次创建、修改和重建目录自动生效", async () => {
    await mkdir(join(directory, "public"));
    await change(
      () => writeFile(join(directory, "public/probe.txt"), "first"),
      () => exists("templates/probe.txt"),
    );
    await change(
      () => writeFile(join(directory, "public/probe.txt"), "second"),
      async () => (await read("templates/probe.txt")) === "second",
    );
    await change(
      () => rm(join(directory, "public"), { recursive: true }),
      async () => !(await exists("templates/probe.txt")),
    );
    await mkdir(join(directory, "public"));
    await change(
      () => writeFile(join(directory, "public/probe.txt"), "recreated"),
      () => exists("templates/probe.txt"),
    );
    await change(
      () => writeFile(join(directory, "public/probe.txt"), "watched again"),
      async () => (await read("templates/probe.txt")) === "watched again",
    );
  });

  await t.test("页面可引用 public 中已有的模块资源，并监听资源修改", async () => {
    const index = await read("src/index.html");
    await mkdir(join(directory, "public/assets"));
    await change(
      async () => {
        await writeFile(
          join(directory, "public/assets/vendor.js"),
          'console.log("public-initial");\n',
        );
        await writeFile(
          join(directory, "src/index.html"),
          index.replace(
            "</include>",
            '<script type="module" src="/assets/vendor.js"></script></include>',
          ),
        );
      },
      async () =>
        (await read("templates/index.html")).includes("/assets/vendor.js") &&
        (await read("templates/assets/vendor.js")).includes("public-initial"),
    );
    await change(
      () =>
        writeFile(join(directory, "public/assets/vendor.js"), 'console.log("public-updated");\n'),
      async () => (await read("templates/assets/vendor.js")).includes("public-updated"),
    );
  });

  await t.test("主题 ID 修改会重新加载配置和资源基础路径", async () => {
    const theme = await read("theme.yaml");
    await change(
      () =>
        writeFile(
          join(directory, "theme.yaml"),
          theme.replace(/^(\s*name:).*$/m, "$1 theme-watch-test"),
        ),
      async () => (await read("templates/index.html")).includes("/themes/theme-watch-test/assets/"),
    );
  });

  await t.test("根目录环境变量新增和修改自动生效", async () => {
    const index = await read("src/index.html");
    await change(
      async () => {
        await writeFile(join(directory, ".env"), "VITE_THEME_BUILD_PROBE=initial\n");
        await writeFile(
          join(directory, "src/index.html"),
          index.replace(/<\/include>\s*$/, '<p data-env="%VITE_THEME_BUILD_PROBE%"></p></include>'),
        );
      },
      async () => (await read("templates/index.html")).includes('data-env="initial"'),
    );
    await change(
      () => writeFile(join(directory, ".env"), "VITE_THEME_BUILD_PROBE=updated\n"),
      async () => (await read("templates/index.html")).includes('data-env="updated"'),
    );
    await change(
      async () => {
        await writeFile(join(directory, "src/index.html"), index);
        await rm(join(directory, ".env"));
      },
      async () => !(await read("templates/index.html")).includes("data-env"),
    );
  });

  await t.test("导入的配置文件修改、原子替换和错误恢复自动生效", async () => {
    const config = await read("vite.config.ts");
    await mkdir(join(directory, "build-config"));
    const helperPath = join(directory, "build-config/probe.ts");
    await writeFile(helperPath, "export const marker = ;\n");
    const initialFailures = failures();
    await writeFile(
      join(directory, "vite.config.ts"),
      'import { marker } from "./build-config/probe";\n' +
        config.replace(
          "plugins: [",
          `plugins: [{
                name: "config-dependency-test",
                transformIndexHtml(html) { return html + "<!-- config: " + marker + " -->"; }
              },`,
        ),
    );
    await waitFor(() => failures() > initialFailures);
    await change(
      () => writeFile(helperPath, 'export const marker = "initial";\n'),
      async () => (await read("templates/index.html")).includes("<!-- config: initial -->"),
    );
    await change(
      () => writeFile(helperPath, 'export const marker = "updated";\n'),
      async () => (await read("templates/index.html")).includes("<!-- config: updated -->"),
    );
    await writeFile(helperPath + ".tmp", 'export const marker = "replaced";\n');
    await change(
      () => rename(helperPath + ".tmp", helperPath),
      async () => (await read("templates/index.html")).includes("<!-- config: replaced -->"),
    );
    const previousFailures = failures();
    await writeFile(helperPath, "export const marker = ;\n");
    await waitFor(() => failures() > previousFailures);
    await change(
      () => writeFile(helperPath, 'export const marker = "recovered";\n'),
      async () => (await read("templates/index.html")).includes("<!-- config: recovered -->"),
    );
    await change(
      () => writeFile(join(directory, "vite.config.ts"), config),
      async () => !(await read("templates/index.html")).includes("<!-- config:"),
    );
    await rm(join(directory, "build-config"), { recursive: true });
  });

  await t.test("构建过程中再次保存会串行补构建", async () => {
    const config = await read("vite.config.ts");
    const layout = await read("src/partials/fixture.html");
    const previousBuilds = builds();
    const logStart = output.length;
    await writeFile(
      join(directory, "vite.config.ts"),
      config.replace(
        "plugins: [",
        `plugins: [{
          name: "slow-build-test",
          async buildStart() {
            console.log("TEST_BUILD_START");
            await new Promise(resolve => setTimeout(resolve, 300));
          },
          closeBundle() { console.log("TEST_BUILD_END"); }
        },`,
      ),
    );
    await waitFor(() => output.slice(logStart).includes("TEST_BUILD_START"));
    await writeFile(
      join(directory, "src/partials/fixture.html"),
      layout.replace('data-watch="initial"', 'data-watch="during-build"'),
    );
    await waitFor(() => builds() >= previousBuilds + 2);
    assert.match(await read("templates/index.html"), /data-watch="during-build"/);
    const events = output.slice(logStart).match(/TEST_BUILD_(?:START|END)/g);
    assert.ok(events.length >= 4);
    events.forEach((event, index) => {
      assert.equal(event, index % 2 === 0 ? "TEST_BUILD_START" : "TEST_BUILD_END");
    });
    await change(
      () => writeFile(join(directory, "vite.config.ts"), config),
      () => exists("templates/index.html"),
    );
    await change(
      () => writeFile(join(directory, "src/partials/fixture.html"), layout),
      async () => (await read("templates/index.html")).includes('data-watch="initial"'),
    );
  });

  await t.test("src 移走后恢复仍能继续监听", async () => {
    const previousFailures = failures();
    await rename(join(directory, "src"), join(directory, "src-backup"));
    await waitFor(() => failures() > previousFailures);
    await change(
      () => rename(join(directory, "src-backup"), join(directory, "src")),
      () => exists("templates/index.html"),
    );
    const layout = await read("src/partials/fixture.html");
    await change(
      () =>
        writeFile(
          join(directory, "src/partials/fixture.html"),
          layout.replace('data-watch="initial"', 'data-watch="restored-src"'),
        ),
      async () => (await read("templates/index.html")).includes('data-watch="restored-src"'),
    );
    await change(
      () => writeFile(join(directory, "src/partials/fixture.html"), layout),
      async () => (await read("templates/index.html")).includes('data-watch="initial"'),
    );
  });

  await t.test("缺失和循环片段使构建失败，修正后无需重启", async () => {
    const index = await read("src/index.html");
    for (const replacement of ['<include src="missing.html" />', '<include src="/index.html" />']) {
      const previousFailures = failures();
      await writeFile(join(directory, "src/index.html"), replacement);
      await waitFor(() => failures() > previousFailures);
      assert.match(output, /Template compilation failed/);
      await change(
        () => writeFile(join(directory, "src/index.html"), index),
        async () => (await read("templates/index.html")).includes("BUILD_CONTENT"),
      );
    }
  });

  await t.test("开发构建接受非自闭合空元素且保留整页", async () => {
    const index = await read("src/index.html");
    for (const content of ["<p>BEFORE<br>AFTER</p>", '<input type="search" name="q">']) {
      await change(
        () =>
          writeFile(
            join(directory, "src/index.html"),
            index.replace(/<\/include>\s*$/, content + "</include>"),
          ),
        async () => (await read("templates/index.html")).includes(content),
      );
      const page = await read("templates/index.html");
      for (const expected of ["<html", "<head", "<section", "BUILD_CONTENT"]) {
        assert.ok(page.includes(expected), expected);
      }
    }
    await change(
      () => writeFile(join(directory, "src/index.html"), index),
      async () => !(await read("templates/index.html")).includes('name="q"'),
    );
  });

  // 停止监听后再验证产物，避免构建清空输出目录干扰故障注入。
  child.kill("SIGTERM");
  await closed;
  const verify = () => run(process.execPath, ["scripts/verify-build.mjs"], { cwd: directory });
  const build = () =>
    run(
      process.execPath,
      ["--input-type=module", "-e", 'import { build } from "vite-plus"; await build();'],
      { cwd: directory },
    );
  await t.test("单次构建的页面和片段均接受非自闭合空元素", async () => {
    const index = await read("src/index.html");
    const layout = await read("src/partials/fixture.html");
    try {
      await writeFile(
        join(directory, "src/index.html"),
        index.replace(
          /<\/include>\s*$/,
          '<p>BEFORE<br>AFTER</p><input type="search" name="q"></include>',
        ),
      );
      await writeFile(
        join(directory, "src/partials/fixture.html"),
        layout.replace("<slot />", "<p>PARTIAL<br>AFTER</p><slot />"),
      );
      await build();
      const page = await read("templates/index.html");
      assert.match(page, /BEFORE<br>AFTER/);
      assert.match(page, /PARTIAL<br>AFTER/);
      assert.match(page, /<input type="search" name="q">/);
      await verify();
    } finally {
      await writeFile(join(directory, "src/index.html"), index);
      await writeFile(join(directory, "src/partials/fixture.html"), layout);
      await build();
    }
  });
  await t.test("产物检查覆盖源码入口，不限制模块名称和页面结构", async () => {
    const originalPath = join(directory, "src/modules/navigation.html");
    const renamedPath = join(directory, "src/modules/nav-tree.html");
    await rename(originalPath, renamedPath);
    await mkdir(join(directory, "src/custom/partials"), { recursive: true });
    await writeFile(join(directory, "src/custom/landing.html"), "<article>Custom page</article>\n");
    await writeFile(join(directory, "src/custom/partials/card.html"), "<p>Private partial</p>\n");
    await build();
    await verify();
    assert.equal(await exists("templates/modules/navigation.html"), false);
    assert.equal(await exists("templates/custom/partials/card.html"), false);
    for (const name of ["modules/nav-tree.html", "custom/landing.html"]) {
      const path = join(directory, "templates", name);
      await rename(path, path + ".backup");
      try {
        await assert.rejects(verify, /Missing build output: templates\//);
      } finally {
        await rename(path + ".backup", path);
      }
    }
  });
  await t.test("布局契约允许不同容器和判空写法，拒绝错误签名及缺失插入点", async () => {
    const path = join(directory, "templates/layout.html");
    const layout = await read("templates/layout.html");
    try {
      for (const declaration of [
        'th:fragment="html(head, content)"',
        "th:fragment=' html ( head , content ) '",
      ]) {
        await writeFile(path, layout.replace('th:fragment="html (head, content)"', declaration));
        await verify();
      }
      await writeFile(path, layout.replace('th:replace="${content}"', 'th:insert="${ content }"'));
      await verify();
      await writeFile(
        path,
        layout
          .replace('th:if="${head != null}"', 'th:unless="${head == null}"')
          .replaceAll("section", "article"),
      );
      await verify();
      await writeFile(path, layout.replace('th:replace="${head}"', ""));
      await assert.rejects(verify, /missing head insertion/);
      await writeFile(path, layout.replace('th:replace="${content}"', ""));
      await assert.rejects(verify, /missing content insertion/);
      await writeFile(
        path,
        layout.replace('th:fragment="html (head, content)"', 'th:fragment="html(content, head)"'),
      );
      await assert.rejects(verify, /missing html\(head, content\) fragment/);
    } finally {
      await writeFile(path, layout);
    }
  });
  await t.test("产物检查拒绝缺失的已引用 JS 和 CSS", async () => {
    const index = await read("templates/index.html");
    const references = Array.from(
      index.matchAll(/\b(?:src|href)="\/themes\/[^/]+\/([^"]+\.(?:js|css))"/g),
      (match) => match[1],
    );
    assert.ok(references.some((path) => path.endsWith(".js")));
    assert.ok(references.some((path) => path.endsWith(".css")));
    for (const reference of new Set(references)) {
      const path = join(directory, "templates", reference);
      await rename(path, path + ".backup");
      try {
        await assert.rejects(verify, /Missing build output: templates\/assets\/.+referenced by/);
      } finally {
        await rename(path + ".backup", path);
      }
    }
  });
  await t.test("资源检查解析嵌套相对路径并跳过外部和动态引用", async () => {
    await mkdir(join(directory, "templates/probe"));
    const path = join(directory, "templates/probe/resources.html");
    const layout = await read("templates/layout.html");
    const stylesheet = layout.match(/href="\/themes\/[^/]+\/(assets\/[^"]+\.css)"/)[1];
    try {
      await writeFile(
        path,
        `<link href="../${stylesheet}?v=1&amp;mode=test#fragment" rel="stylesheet">
        <script src="https://cdn.example.invalid/example.js"></script>
        <img src="/site-owned/image.png">
        <img th:src="@{/assets/dynamic.png}">
        <img src="\${dynamicImage}">
        <img src="assets/prototype.png" th:src="\${dynamicImage}">
        <link href="assets/prototype.css" data-th-href="\${dynamicStylesheet}">
        <!-- <img src="../assets/commented-out.png"> -->
        <img alt='Example src="assets/missing.png"'>
        <script>const example = '<img src="assets/missing.png">';</script>`,
      );
      await verify();
      await writeFile(path, '<script src="../assets/missing.js"></script>');
      await assert.rejects(verify, /Missing build output: templates\/assets\/missing\.js/);
    } finally {
      await rm(join(directory, "templates/probe"), { recursive: true });
    }
  });
  await t.test("没有静态资源入口的主题也可以通过产物检查", async () => {
    const index = await read("src/index.html");
    const layout = await read("src/layout.html");
    await rename(join(directory, "public"), join(directory, "public-backup"));
    try {
      await writeFile(join(directory, "src/index.html"), "<article>Static content</article>\n");
      await writeFile(
        join(directory, "src/layout.html"),
        layout.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
      );
      await build();
      await verify();
      assert.equal(await exists("templates/assets"), false);
    } finally {
      await writeFile(join(directory, "src/index.html"), index);
      await writeFile(join(directory, "src/layout.html"), layout);
      await rename(join(directory, "public-backup"), join(directory, "public"));
      await build();
    }
  });
  await t.test("产物检查覆盖布局和新增的嵌套 HTML", async () => {
    await verify();
    const layout = await read("templates/layout.html");
    await writeFile(
      join(directory, "templates/layout.html"),
      layout + "<!-- Partial error: test -->",
    );
    await assert.rejects(verify, /template compilation error/);
    await writeFile(join(directory, "templates/layout.html"), layout);
    await mkdir(join(directory, "templates/error"), { recursive: true });
    await writeFile(join(directory, "templates/error/404.html"), '<include src="missing.html" />');
    await assert.rejects(verify, /unprocessed include or slot tag/);
  });
});
