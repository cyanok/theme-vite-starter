# 依赖兼容性补丁

`@halo-dev/vite-plugin-halo-theme@1.0.3` 的补丁由 `pnpm-workspace.yaml` 声明，安装依赖时自动应用，覆盖以下问题：

- HTML 原生空元素：正确处理没有自闭合斜杠的 `<img>`、`<input>` 等元素，避免后续内容被错误嵌套。
- 元素内文本：保留 `script`、`style`、`textarea` 和 `title` 中的文本，避免将其中的 `<` 等内容误作 HTML 标签。
- 构建入口名称：保留模板相对路径，避免 `foo.html` 与 `foo/index.html`、`foo/bar.html` 与 `foo_bar.html` 的入口名称碰撞。

升级插件后，按上游已修复的范围缩减补丁；全部问题均已修复时移除整个补丁。同步 `pnpm-workspace.yaml` 与锁文件，并运行 `pnpm test:build` 和 `pnpm build` 验证。不要直接修改 `node_modules/`。

## 上游追踪

上游仓库为 [halo-sigs/vite-plugin-halo-theme](https://github.com/halo-sigs/vite-plugin-halo-theme)，问题与修复可在 [Issues](https://github.com/halo-sigs/vite-plugin-halo-theme/issues) 和 [Pull requests](https://github.com/halo-sigs/vite-plugin-halo-theme/pulls) 中追踪。

截至 2026-10-09，本次核对全部公开 Issue 和 PR 后，未找到上述三类补丁对应的记录，暂以本项目的构建回归测试追踪。该结果不表示问题从未通过其他渠道反馈；后续发现对应记录时补充具体链接。
