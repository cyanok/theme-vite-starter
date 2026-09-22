import { watch } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite-plus";

const projectRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const directories = ["src", "public"];
const configurationFiles = new Set(["theme.yaml", "vite.config.ts", "tsconfig.json"]);
const directoryWatchers = new Map();
const configurationWatchers = new Map();
let configurationDependencies = new Map();
let failedConfigurationWatcher;
let timer;
let building = false;
let pending = false;
let stopped = false;

process.chdir(projectRoot);

// 每次重新加载配置，让片段改动和 HTML 入口增删都进入新的构建。
async function rebuild() {
  if (building || stopped) return;
  building = true;
  pending = false;
  let configurationResolved = false;
  try {
    await build({
      build: { watch: null },
      plugins: [
        {
          name: "watch-theme-configuration",
          configResolved(config) {
            configurationResolved = true;
            watchConfigurationDependencies(config.configFileDependencies);
            failedConfigurationWatcher?.close();
            failedConfigurationWatcher = undefined;
          },
        },
      ],
    });
    console.log("主题构建完成，继续监听源码变化。");
  } catch (error) {
    if (!configurationResolved) watchFailedConfiguration();
    console.error(error instanceof Error ? error.message : String(error));
    console.error("主题构建失败，修正后保存文件将自动重试。");
  } finally {
    building = false;
    if (pending && !stopped) scheduleBuild();
  }
}

function scheduleBuild() {
  pending = true;
  clearTimeout(timer);
  timer = setTimeout(() => void rebuild(), 100);
}

function watchDirectory(directory) {
  directoryWatchers.get(directory)?.close();
  directoryWatchers.delete(directory);
  try {
    const watcher = watch(join(projectRoot, directory), { recursive: true }, scheduleBuild);
    watcher.on("error", handleWatchError);
    directoryWatchers.set(directory, watcher);
  } catch (error) {
    // public 可选；目录创建或重新创建时由根目录监听器补上监听。
    if (error.code !== "ENOENT") throw error;
  }
}

function watchConfigurationDependencies(files) {
  if (stopped) return;
  const nextDependencies = new Map();
  for (const file of files) {
    const path = resolve(file);
    const directory = dirname(path);
    if (!nextDependencies.has(directory)) nextDependencies.set(directory, new Set());
    nextDependencies.get(directory).add(basename(path));
  }
  configurationDependencies = nextDependencies;
  for (const [directory, watcher] of configurationWatchers) {
    if (!nextDependencies.has(directory)) {
      watcher.close();
      configurationWatchers.delete(directory);
    }
  }
  for (const directory of nextDependencies.keys()) {
    if (directory === projectRoot || configurationWatchers.has(directory)) continue;
    // 监听父目录，保证编辑器原子替换文件后仍能继续监听。
    const watcher = watch(directory, (_event, filename) => {
      if (filename === null || configurationDependencies.get(directory)?.has(filename)) {
        scheduleBuild();
      }
    });
    watcher.on("error", handleWatchError);
    configurationWatchers.set(directory, watcher);
  }
}

function watchFailedConfiguration() {
  if (stopped || failedConfigurationWatcher) return;
  // 首次解析失败时 Vite 尚未提供依赖列表；临时监听项目文件以捕获修正，
  // 成功解析后恢复精确监听，忽略依赖、产物和工具元数据目录。
  const ignored = new Set(["node_modules", "templates", "dist", ".git", ".agents", ".codex"]);
  failedConfigurationWatcher = watch(projectRoot, { recursive: true }, (_event, filename) => {
    if (filename === null || !ignored.has(filename.split(/[\\/]/)[0])) scheduleBuild();
  });
  failedConfigurationWatcher.on("error", handleWatchError);
}

const rootWatcher = watch(projectRoot, (_event, filename) => {
  if (filename === null) {
    directories.forEach(watchDirectory);
    scheduleBuild();
    return;
  }
  if (directories.includes(filename)) {
    watchDirectory(filename);
    scheduleBuild();
  } else if (
    configurationFiles.has(filename) ||
    configurationDependencies.get(projectRoot)?.has(filename) ||
    filename.startsWith(".env")
  ) {
    scheduleBuild();
  }
});
rootWatcher.on("error", handleWatchError);

function stop(exitCode) {
  stopped = true;
  clearTimeout(timer);
  rootWatcher.close();
  for (const watcher of directoryWatchers.values()) watcher.close();
  for (const watcher of configurationWatchers.values()) watcher.close();
  failedConfigurationWatcher?.close();
  process.exitCode = exitCode;
}

function handleWatchError(error) {
  console.error("无法监听主题文件：", error.message);
  stop(1);
}

process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));

directories.forEach(watchDirectory);
console.log("正在监听 src/、public/ 和主题构建配置。");
await rebuild();
