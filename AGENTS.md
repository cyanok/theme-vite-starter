# 项目协作约定

- 目标运行环境为 Halo `>=2.26.0`。
- Node.js 版本参考 `.node-version`，pnpm 版本以 `package.json` 的 `packageManager` 为准；调整工具链版本时同步检查 CI、Release 工作流与 README。
- 项目文本文件使用 UTF-8、LF 换行和文件末尾换行；遵循 `.gitattributes`、`.editorconfig` 与 `vite.config.ts` 中的格式约束。
- `src/` 是源码目录，`templates/` 和 `dist/` 是构建产物；禁止直接编辑或提交构建产物。

## 模板与构建约定

- `src/layout.html` 实现 Halo 2.26 运行时页面布局契约，并构建为 `templates/layout.html`；保留 `html(head, content)` 参数顺序与两个插入点。
- `src/partials/layout.html` 是现有主题页面通过 `<include>` / `<slot>` 使用的 Vite 构建期私有布局，两者职责不同。
- 两种布局共享的页头、导航与页脚在 `src/modules/` 中维护，由 Halo 解析；调整共享布局时同时检查普通主题页面和插件页面。
- `src/` 下的 `.html` 文件自动作为构建入口，任意层级的 `partials/` 目录除外；新增页面和运行时片段后检查对应产物。
- 参与构建的资源放在 `src/assets/`；共享布局中的资源入口使用相对于 `src/` 的根路径。无需编译的资源放在 `public/`，构建时原样复制到 `templates/`。
- `pnpm dev` 使用生产构建模式串行重建，不启动预览服务器；页面预览依赖 Halo，修改主题元数据或设置表单后还需重载主题配置。
- 依赖兼容性补丁由 `pnpm-workspace.yaml` 的 `patchedDependencies` 管理；修改或升级相关依赖时同时检查 `patches/` 与锁文件，不直接修改 `node_modules/`。

## 常用命令

- `pnpm install --frozen-lockfile`：按锁文件安装依赖。
- `pnpm check`：只检查格式与代码问题，不修改文件。
- `pnpm fix`：自动修复格式与可修复的代码问题。
- `pnpm test:build`：在临时目录验证开发监听、模板编译、错误恢复和产物检查。
- `pnpm build-only`：执行 TypeScript 检查并生成 `templates/`。
- `pnpm verify:build`：检查页面、布局契约和静态资源构建产物。
- `pnpm dev`：监听源码、片段和页面增删，串行重新构建主题。
- `pnpm build`：执行静态检查、构建与产物验证，通过后打包可发布的主题 ZIP。
- `pnpm skills:update`：从 `skills-lock.json` 记录的来源更新项目 Agent Skill，更新后复核技能文件与锁文件的 diff。

## 按变更范围验证

- 仅修改文档时运行 `pnpm check`。
- 修改主题源码、资源或元数据时运行 `pnpm build`，检查最终 diff；该命令包含静态检查、TypeScript 检查、构建、产物验证和打包。
- 修改构建脚本、配置、依赖或补丁时，额外运行 `pnpm test:build`；`pnpm build` 不包含该测试。
- 修改 Thymeleaf 表达式、Finder 调用、布局、样式或插件集成时，在 Halo 中按 `docs/halo-smoke-test.md` 验证受影响的页面；静态检查和构建测试不能替代运行时验证。没有兼容的 Halo 实例时，明确记录未执行项。
