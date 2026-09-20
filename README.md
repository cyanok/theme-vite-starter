# Theme Vite Starter

面向社区开发者的 Halo 2.26+ 主题快速开始模板，集成 Vite Plus、TypeScript 和 Halo 主题构建插件，提供基础页面、格式与代码检查，以及 ZIP 打包能力。

## 环境要求

- Halo `>=2.26.0`
- Node.js `>=24.11.0`，推荐使用 [.node-version](.node-version) 指定的版本
- pnpm `12.4.2`，与 [package.json](package.json) 的版本声明保持一致

## 快速开始

1. 基于此模板创建仓库并克隆到本地。
2. 修改 `theme.yaml` 中的主题 ID（`metadata.name`）、显示名称、作者和仓库地址；为主题设置独立的 `spec.settingName` 和 `spec.configMapName`，并让 `settings.yaml` 的 `metadata.name` 与 `spec.settingName` 一致。
3. 将项目目录放入 Halo 工作目录的 `themes/<主题 ID>/`，目录名须与 `metadata.name` 一致。
4. 在项目根目录安装依赖并启动监听构建：

   ```bash
   pnpm install --frozen-lockfile
   pnpm dev
   ```

5. 首次构建完成后，在 Halo 控制台的「主题」→「切换主题」→「未安装」中安装并启用主题，然后访问 Halo 站点预览。

`pnpm dev` 会在源码变化时重新生成 `templates/`，页面由 Halo 渲染。开发环境需关闭 Thymeleaf 缓存；使用 Docker 时设置 `SPRING_THYMELEAF_CACHE=false`，并将项目目录挂载到容器内对应的主题目录。详见 [Halo 开发环境准备](https://docs.halo.run/developer-guide/theme/prepare)。

## 目录与布局

```text
.
├── src/                 # HTML 页面、CSS 和 TypeScript 源码
│   ├── layout.html      # Halo 2.26+ 运行时页面布局
│   └── partials/        # 构建期复用的布局和模板片段
├── public/              # 可选；构建时原样复制到 templates/
├── templates/           # 构建生成，禁止直接编辑
├── dist/                # 打包生成的主题 ZIP
├── theme.yaml           # 主题元数据
├── settings.yaml        # 控制台主题设置表单
└── vite.config.ts       # Vite Plus 与 Halo 主题插件配置
```

在 `src/` 中开发，构建会生成 Halo 使用的 `templates/`。两种布局分别用于：

- `src/partials/layout.html`：主题页面的公共布局，通过 `<include>` / `<slot>` 在构建时展开。
- `src/layout.html`：构建为 `templates/layout.html`，提供 `html(head, content)` 片段，供插件前台页面复用主题布局，详见 [Halo 页面布局契约](https://docs.halo.run/developer-guide/theme/page-layout)。

## 常用命令

| 命令                | 说明                                         |
| ------------------- | -------------------------------------------- |
| `pnpm dev`          | 监听源码变化并持续构建                       |
| `pnpm check`        | 检查格式与代码问题                           |
| `pnpm fix`          | 自动修复格式与可修复的代码问题               |
| `pnpm build-only`   | 执行 TypeScript 检查并生成 `templates/`      |
| `pnpm verify:build` | 验证已有构建产物中的页面、布局契约和静态资源 |
| `pnpm build`        | 执行 TypeScript 检查、构建并打包主题 ZIP     |

## 打包与发布

```bash
pnpm check
pnpm build
pnpm verify:build
```

生成的 `dist/<主题 ID>-<版本>.zip` 可在 Halo 控制台上传安装。发布前请在 Halo 2.26+ 中验证页面效果。

项目包含 [CI 检查](.github/workflows/ci.yaml)和 [Release 发布工作流](.github/workflows/cd.yaml)，按需调整自己的发布配置。

更多主题开发用法见 [Halo 主题开发文档](https://docs.halo.run/developer-guide/theme/)。
