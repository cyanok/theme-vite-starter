# Theme Vite Starter

面向 Halo `>=2.26.0` 的 Vite Plus 主题脚手架。主题源码位于 `src/`，构建后生成 Halo 实际读取的 `templates/`，并可打包为控制台可安装的 ZIP。

官方主题开发指南：<https://docs.halo.run/developer-guide/theme/>

## 环境基线

- Halo `>=2.26.0`
- Node.js `>=24.11.0`
- pnpm `>=11.24.0`；项目固定使用 `pnpm@11.24.0`
- Vite Plus `0.3.0`
- TypeScript 6

依赖安装：

```bash
pnpm install --frozen-lockfile
```

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
