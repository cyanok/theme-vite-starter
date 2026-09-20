import { watch } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite-plus";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const directories = ["src", "public"];
const configurationFiles = new Set(["theme.yaml", "vite.config.ts", "tsconfig.json"]);
const directoryWatchers = new Map();
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
  try {
    await build({ build: { watch: null } });
    console.log("主题构建完成，继续监听源码变化。");
  } catch (error) {
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

const rootWatcher = watch(projectRoot, (_event, filename) => {
  if (filename === null) {
    directories.forEach(watchDirectory);
    scheduleBuild();
    return;
  }
  if (directories.includes(filename)) {
    watchDirectory(filename);
    scheduleBuild();
  } else if (configurationFiles.has(filename) || filename.startsWith(".env")) {
    scheduleBuild();
  }
});
rootWatcher.on("error", handleWatchError);

function stop(exitCode) {
  stopped = true;
  clearTimeout(timer);
  rootWatcher.close();
  for (const watcher of directoryWatchers.values()) watcher.close();
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
