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
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

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
  for (const path of [
    "src",
    "scripts",
    "vite.config.ts",
    "theme.yaml",
    "package.json",
    "tsconfig.json",
    "vite-env.d.ts",
  ]) {
    await cp(join(projectRoot, path), join(directory, path), { recursive: true });
  }
  await symlink(join(projectRoot, "node_modules"), join(directory, "node_modules"), "junction");

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

  await waitFor(() => builds() > 0);

  await t.test("片段修改以及嵌套页面增删自动生效", async () => {
    const layout = await read("src/partials/layout.html");
    await change(
      () =>
        writeFile(
          join(directory, "src/partials/layout.html"),
          layout.replace('class="site-header"', 'class="site-header" data-watch="updated"'),
        ),
      async () => (await read("templates/index.html")).includes('data-watch="updated"'),
    );

    await mkdir(join(directory, "src/error"));
    await change(
      () =>
        writeFile(
          join(directory, "src/error/404.html"),
          '<include src="layout.html"><p>Nested page</p></include>',
        ),
      () => exists("templates/error/404.html"),
    );
    assert.match(await read("templates/error/404.html"), /data-watch="updated"/);
    await change(
      () => rm(join(directory, "src/error"), { recursive: true }),
      async () => !(await exists("templates/error/404.html")),
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

  await t.test("构建过程中再次保存会串行补构建", async () => {
    const config = await read("vite.config.ts");
    const layout = await read("src/partials/layout.html");
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
      join(directory, "src/partials/layout.html"),
      layout.replace('data-watch="updated"', 'data-watch="during-build"'),
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
  });

  await t.test("src 移走后恢复仍能继续监听", async () => {
    const previousFailures = failures();
    await rename(join(directory, "src"), join(directory, "src-backup"));
    await waitFor(() => failures() > previousFailures);
    await change(
      () => rename(join(directory, "src-backup"), join(directory, "src")),
      () => exists("templates/index.html"),
    );
    const layout = await read("src/partials/layout.html");
    await change(
      () =>
        writeFile(
          join(directory, "src/partials/layout.html"),
          layout.replace('data-watch="during-build"', 'data-watch="restored-src"'),
        ),
      async () => (await read("templates/index.html")).includes('data-watch="restored-src"'),
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
        async () => (await read("templates/index.html")).includes("post-list"),
      );
    }
  });

  // 停止监听后再验证产物，避免构建清空输出目录干扰故障注入。
  child.kill("SIGTERM");
  await closed;
  await t.test("产物检查覆盖布局和新增的嵌套 HTML", async () => {
    const verify = () => run(process.execPath, ["scripts/verify-build.mjs"], { cwd: directory });
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
