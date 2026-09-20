# 项目协作约定

- 目标运行环境为 Halo `>=2.26.0`。
- 项目文本文件使用 UTF-8、LF 换行和文件末尾换行；遵循 `.gitattributes`、`.editorconfig` 与 `vite.config.ts` 中的格式约束。
- `src/` 是源码目录，`templates/` 是构建产物；禁止直接编辑 `templates/`。
- `src/layout.html` 实现 Halo 2.26 运行时页面布局契约，并构建为 `templates/layout.html`。
- `src/partials/layout.html` 是现有主题页面通过 `<include>` / `<slot>` 使用的 Vite 构建期私有布局，两者职责不同。

## 常用命令

- `pnpm install --frozen-lockfile`：按锁文件安装依赖。
- `pnpm check`：只检查格式与代码问题，不修改文件。
- `pnpm fix`：自动修复格式与可修复的代码问题。
- `pnpm build-only`：执行 TypeScript 检查并生成 `templates/`。
- `pnpm verify:build`：检查页面、布局契约和静态资源构建产物。
- `pnpm dev`：以 watch 模式持续构建主题。
- `pnpm build`：构建并打包可发布的主题 ZIP。
- `pnpm skills:update`：从锁定来源更新项目 Agent Skill。
