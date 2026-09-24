# Theme Vite Starter

面向社区开发者的 Halo 2.26+ 主题快速开始模板，集成 Vite Plus、TypeScript 和 Halo 主题构建插件，提供基础页面与主题打包能力。

内置首页、文章、独立页面、文章归档、分类和标签页面。主题源码在 `src/` 中开发，构建后由 Halo 渲染 `templates/` 中的模板。

## 环境要求

- Halo `>=2.26.0`
- Node.js `>=24.21.0`，推荐使用 [.node-version](.node-version) 指定的版本
- pnpm `12.4.2`

## 快速开始

先准备可访问的 Halo 开发实例，并关闭 Thymeleaf 缓存；使用 Docker 时设置 `SPRING_THYMELEAF_CACHE=false`。环境搭建详见 [Halo 开发环境准备](https://docs.halo.run/developer-guide/theme/prepare)。

1. 基于此模板创建仓库并克隆到本地。
2. 修改 `theme.yaml` 中的主题 ID（`metadata.name`）、显示名称、作者、项目链接和版本；为主题设置独立的 `spec.settingName` 和 `spec.configMapName`，并让 `settings.yaml` 的 `metadata.name` 与 `spec.settingName` 一致。
3. 将项目目录放入 Halo 工作目录的 `themes/<主题 ID>/`，目录名须与 `metadata.name` 一致；使用 Docker 时，将项目目录挂载到容器内对应的主题目录。
4. 在项目根目录安装依赖并启动监听构建：

   ```bash
   pnpm install --frozen-lockfile
   pnpm dev
   ```

5. 首次构建完成后，在 Halo 控制台的「主题」→「切换主题」→「未安装」中安装并启用主题，然后访问 Halo 站点预览。

`pnpm dev` 自动更新 `templates/`，预览地址使用 Halo 站点地址，查看改动时手动刷新浏览器。该命令不启动 Vite 开发服务器。构建失败后，修正文件并保存即可自动重试。

修改 `theme.yaml` 或 `settings.yaml` 后，还需在 Halo 控制台的主题详情中点击「重载主题配置」使配置生效。

## 日常开发

监听范围包括 `src/`、`public/`，以及项目根目录的 `theme.yaml`、`vite.config.ts`、`tsconfig.json` 和 `.env*`。修改监听范围外的配置依赖，或安装、更新依赖后，重新启动 `pnpm dev`。

环境变量文件放在项目根目录。`pnpm dev` 和 `pnpm build` 默认使用 Vite 的生产构建模式，读取 `.env`、`.env.local`、`.env.production` 和 `.env.production.local`。

浏览器代码通过 `import.meta.env.VITE_*` 访问以 `VITE_` 开头的变量。这些值会写入构建产物，只用于公开配置；本地专用配置可放入 Git 已忽略的 `*.local` 文件。

使用 `pnpm check` 检查格式与代码问题，`pnpm fix` 自动修复可处理的问题。修改页面、样式或插件集成后，按 [运行时冒烟清单](docs/halo-smoke-test.md) 在 Halo 中检查受影响的页面。

## 目录与布局

```text
.
├── src/                 # HTML 页面、CSS 和 TypeScript 源码
│   ├── assets/          # 参与构建的样式和脚本
│   │   ├── css/         # CSS 样式
│   │   └── js/          # TypeScript 脚本
│   ├── layout.html      # Halo 2.26+ 运行时页面布局
│   ├── modules/         # Thymeleaf 运行时模板片段
│   └── partials/        # 构建期复用的布局和模板片段
├── scripts/             # 开发与验证脚本
├── docs/                # Halo 运行时冒烟清单与正文示例
├── patches/             # pnpm 管理的依赖兼容性补丁
├── public/              # 可选；构建时原样复制到 templates/
├── templates/           # 构建生成，禁止直接编辑
├── dist/                # 打包生成的主题 ZIP
├── theme.yaml           # 主题元数据
├── settings.yaml        # 控制台主题设置表单
└── vite.config.ts       # Vite Plus 与 Halo 主题插件配置
```

两种布局分别用于：

- `src/partials/layout.html`：主题页面的公共布局，通过 `<include>` / `<slot>` 在构建时展开。
- `src/layout.html`：构建为 `templates/layout.html`，提供 `html(head, content)` 片段，供插件前台页面复用主题布局，详见 [Halo 页面布局契约](https://docs.halo.run/developer-guide/theme/page-layout)。

两种布局通过 `src/modules/header.html` 和 `src/modules/footer.html` 共享页头、导航与页脚，由 Halo 在运行时解析。页头和页脚内容统一在这两个片段中维护。

`src/` 下的 `.html` 文件自动作为构建入口，并保留相对目录输出到 `templates/`；任意层级的 `partials/` 目录都只用于构建期复用，不单独输出。`modules/` 中的运行时片段需要保留在产物中，不要移入 `partials/`。

主题页面可参考 `src/index.html`，使用以下结构复用公共布局：

```html
<include src="layout.html">
  <template name="head">
    <title th:text="${site.title}">Site Title</title>
  </template>

  <h1 th:text="${site.title}">Site Title</h1>
</include>
```

这里的 `layout.html` 由构建插件从 `src/partials/` 中查找；`template name="head"` 替换布局的具名插槽，其余内容填入默认插槽。新增模板的文件名与访问方式需遵循 [Halo 模板路由映射](https://docs.halo.run/developer-guide/theme/template-route-mapping)，添加 HTML 文件本身不会注册新的站点路由；文章、独立页面和分类的自定义模板需在 `theme.yaml` 的 `spec.customTemplates` 中声明。

共享布局中的资源入口使用以 `/` 开头、相对于 `src/` 根目录的路径，如 `/assets/js/main.ts`。

`src/assets/js/main.ts` 导入 `src/assets/css/main.css` 并处理正文宽内容。页面需要独立脚本时，将脚本放入 `src/assets/js/`，并在该页面的 `head` 模板中添加对应的模块入口。

无需编译的静态资源放入 `public/assets/`，构建后位于 `templates/assets/`。例如 `public/assets/logo.svg` 可在运行时模板中通过 `th:src="@{/assets/logo.svg}"` 引用。

依赖安装会自动应用主题构建插件的兼容性补丁，详见 [补丁说明](patches/README.md)。修改构建脚本、配置、依赖或补丁后，额外运行 `pnpm test:build` 验证开发监听和模板编译。

## 打包与发布

```bash
pnpm build
```

主题 ID 和版本由 `theme.yaml` 中的 `metadata.name` 与 `spec.version` 定义。命令完成静态检查、TypeScript 检查、构建和产物验证后，生成 `dist/<主题 ID>-<版本>.zip`，可在 Halo 控制台上传安装。

只需生成模板时，可运行 `pnpm build-only` 执行 TypeScript 检查并生成 `templates/`；`pnpm verify:build` 用于检查已有产物，不会自动构建。

发布前请按 [Halo 2.26 运行时冒烟清单](docs/halo-smoke-test.md) 在 Halo 中验证主要页面、空状态、分页、评论和插件页面布局，并使用其中的示例正文检查移动端适配。

项目提供两套工作流：

- [CI 检查](.github/workflows/ci.yaml)：执行静态检查、构建流程测试、构建、产物验证和 ZIP 打包。
- [Release 发布](.github/workflows/cd.yaml)：发布 GitHub Release 时触发，使用 Halo 共享工作流构建并发布主题，默认跳过应用市场发布；需要发布到应用市场时，按工作流注释配置发布选项。

发布前更新 `theme.yaml` 的 `spec.version`，GitHub Release 标签不会自动回写主题版本。

更多主题开发用法见 [Halo 主题开发文档](https://docs.halo.run/developer-guide/theme/)。
