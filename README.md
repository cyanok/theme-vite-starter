# Theme Vite Starter

面向 Halo `>=2.26.0` 的 Vite Plus 主题脚手架。主题源码位于 `src/`，构建后生成 Halo 实际读取的 `templates/`，并可打包为控制台可安装的 ZIP。

官方主题开发指南：<https://docs.halo.run/developer-guide/theme/>

## 环境基线

- Halo `>=2.26.0`
- Node.js `>=24.11.0`
- pnpm `>=11.24.0`；项目固定使用 `pnpm@11.24.0`
- Vite Plus `0.3.3`
- TypeScript 6

依赖安装：

```bash
pnpm install --frozen-lockfile
```

## Vite Plus 更新方案

项目已使用 Vite Plus，通过 `pnpm-workspace.yaml` 的 catalog 统一固定 `vite-plus` 和 `vite` 核心别名。针对 `0.3.0` → `0.3.3`，推荐采用[官方支持的手动更新方式](https://viteplus.dev/guide/upgrade-project#manually-updating)，同步调整两项版本并更新锁文件，保留现有检查、Git hook 和 Halo 主题构建流程。

- 将 catalog 中的 `vite-plus` 固定为 `0.3.3`，将 `vite` 固定为 `npm:@voidzero-dev/vite-plus-core@0.3.3`；保留 `package.json` 的 `catalog:` 引用和 `vite@*` override，确保 Halo 插件与项目使用同一套 Vite。
- 本次内置 Vite 从 `8.2.2` 更新到 `8.3.0`，仍满足 Halo 主题插件 `1.0.3` 声明的 `^7.0.0 || ^8.0.0` 范围。现有 Node.js 24 和 pnpm 11 基线继续适用。项目未使用 `vp pack`、React 或独立的 Vitest 配置，无需对应的配置迁移。
- `0.3.3` 更新了 Oxlint 和 Oxfmt，[发布说明](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.3.3)要求重新检查格式。更新 catalog 后运行 `pnpm install --no-frozen-lockfile` 和 `pnpm fix`，复核差异，再运行 `pnpm install --frozen-lockfile`、`pnpm check`、`pnpm build` 和 `pnpm verify:build`。

后续更新也应同步固定 `vite-plus` 与核心别名版本，并提交相应锁文件变更；普通开发和 CI 仍使用冻结安装。

## 源码与构建产物

```text
.
├── src/                 # 页面、布局、partials、CSS 和 TypeScript 源码
├── public/              # 可选；构建时原样复制到 templates/
├── templates/           # 构建生成，禁止直接编辑
├── scripts/             # 构建产物验证脚本
├── theme.yaml           # 主题元数据
├── settings.yaml        # 控制台主题设置表单
└── vite.config.ts       # Vite Plus 与 Halo 主题插件配置
```

`@halo-dev/vite-plugin-halo-theme` 会把 `src/` 下除 `src/partials/` 外的 HTML 作为多页入口，把 CSS 和 JavaScript 打包到 `templates/assets/`，并将 `public/` 内容原样复制到 `templates/`。`templates/` 是忽略的构建产物目录，所有长期修改都应落在输入目录或根配置中。

## 两种布局的职责

- `src/layout.html` 是 Halo 2.26 的运行时页面布局契约。它构建为 `templates/layout.html`，提供 `html(head, content)` Thymeleaf fragment，让插件前台页面复用当前主题的页头、内容容器、页脚和样式。
- `src/partials/layout.html` 是现有 8 个主题页面使用的 Vite 构建期私有布局。页面中的 `<include src="layout.html">` 仍解析到此 partial，并在构建阶段展开 `<include>` / `<slot>`。

两套布局服务于不同阶段，不应互相替代，也不要直接修改其构建结果。

## 开发、检查与构建

项目文本文件统一使用 UTF-8、LF 换行和文件末尾换行。`.gitattributes` 通过 `text=auto eol=lf` 约束 Git 的文本换行，自动识别二进制文件；`.editorconfig`、VS Code 工作区设置和 Vite Plus 格式器同步使用 LF，避免跨平台编辑时反复产生换行差异。运行 `pnpm fix` 修复格式，运行 `pnpm check` 验证结果。

| 命令                 | 职责                                                      |
| -------------------- | --------------------------------------------------------- |
| `pnpm check`         | 只执行 Vite Plus 检查，不修改文件                         |
| `pnpm fix`           | 自动修复格式与可修复的代码问题                            |
| `pnpm dev`           | 执行 `vp build --watch`，首次构建后持续监听源码变化       |
| `pnpm build-only`    | 执行 TypeScript 检查并生成 `templates/`                   |
| `pnpm verify:build`  | 独立检查 8 个页面、页面布局契约和 CSS/JavaScript 构建资源 |
| `pnpm build`         | 执行 TypeScript 检查、主题构建并生成可分发 ZIP            |
| `pnpm skills:update` | 从 `skills-lock.json` 记录的官方来源同步项目 Agent Skill  |

本地开发时，将仓库放入或链接到 Halo 的 `themes/theme-vite-starter/`，运行 `pnpm dev`，然后在 Halo 控制台安装并启用主题。建议关闭 Thymeleaf 缓存以便调试，例如设置 `SPRING_THYMELEAF_CACHE=false`。

## CI 与发布

`.github/workflows/ci.yaml` 在 pull request 和 `main` 分支 push 时依次安装冻结依赖、执行 `pnpm check`、`pnpm build-only` 和 `pnpm verify:build`。

`.github/workflows/cd.yaml` 保留 release 发布触发方式，使用 Node 24、pnpm 11 和 Halo 的可复用主题发布 workflow；其中的 `pnpm build` 会同时构建并打包主题。

## Agent Skill

`.agents/skills/halo-theme-dev/` 是从 `halo-dev/dev-skills` 同步的官方 Halo 主题开发 Skill，提供主题源码检查、运行时边界、Vite 起始模板与验证要求；涉及版本敏感的模板、Finder API、配置、页面布局和打包契约时，Skill 会按需查询 Halo 官方文档。项目专属规则位于根 `AGENTS.md`，不在官方 Skill 中维护本地分叉。
