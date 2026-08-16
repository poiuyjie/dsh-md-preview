<div align="center">

# dsh-md-preview

*DeepSeek Harness 的 Markdown 预览插件*

</div>

> **对话里点开 `.md`，不再跳 VSCode——右侧并排预览，随手可读。**

<p align="center">
  <img src="assets/demo.png" alt="dsh-md-preview 演示" width="860" />
</p>

DeepSeek Harness（DSH）插件：在会话头部加一个「MD 预览」入口，自动跟踪本会话读写/打开过的 `.md` 文件，点击对话中的 md 引用时**在右侧栏并排打开预览**，而不是跳转到系统编辑器（如 VSCode）。

## 与 dsh-vision-opencode 协同

本插件与 [**dsh-vision-opencode**](https://github.com/poiuyjie/dsh-vision-opencode) 配合使用，效果成倍提升——它也是在这个视觉插件的能力基础上开发完善起来的：

- **视觉驱动的工作流闭环**：`dsh-vision-opencode` 给纯文本主模型补上识图能力（`vision_read_image`），让模型能"看见"渲染出的文档页面；而本插件让你在右侧栏**即时打开并排预览**对应的 `.md` 源文件——先看渲染图，再对照源稿，改稿、验证、记录一气呵成
- **图文对照**：左侧对话流里是视觉验证结论（"表格 III 渲染干净、无溢出"），右侧预览栏里就是对应的 Markdown 源稿，边看边改
- **适合文档 / 论文工作流**：LaTeX 编译检查、排版 QA、版本修订记录等场景下，视觉确认 + 源稿预览双栏并排，效果大大提高

两个插件搭配安装：

```bash
cd ~/.dsh/profiles/web
npm pkg set "dependencies.dsh-vision-opencode=github:poiuyjie/dsh-vision-opencode"
npm pkg set "dependencies.dsh-md-preview=github:poiuyjie/dsh-md-preview"
```

## 功能

- **右侧并排预览**：点击对话中的 `.md` 文件引用（产物芯片 / 行内引用 / 工具卡片路径），在右侧栏打开预览，与对话内容顶部对齐、宽度可拖（支持拖到屏幕中间），布局自动让位、不遮挡对话
- **会话隔离的最近列表**：自动收集本会话读写/打开过的 `.md` 文件（读/写/改/删 + 时间 + 文件 mtime），每个会话只看到自己访问过的文件，互不串扰
- **两类打开方式**：
  - 浮动窗口：可拖动、可缩放，位置/大小记忆（localStorage）
  - 右侧停靠：与对话并排，左缘分隔线可拖动调宽
- **修饰键逃生**：按住 Ctrl/Cmd/Shift 点击 md 引用，仍走系统默认应用打开（VSCode）
- **手动打开**：输入相对工作目录的 `.md` 路径即可预览
- **完整 Markdown 渲染**：标题 / 列表 / 表格 / 代码块 / 引用 / 行内代码 / 公式片段 / 图片链接
- **「对话/轨迹」栏页签**：也提供整页「MD 预览」页签

## 安装

在你的 DSH web profile 中添加依赖（以 `~/.dsh/profiles/web` 为例）：

```bash
cd ~/.dsh/profiles/web
npm pkg set "dependencies.dsh-md-preview=github:poiuyjie/dsh-md-preview"
npx dsh plugin --profile web add dsh-md-preview@github:poiuyjie/dsh-md-preview
```

或者直接在 `package.json` 中加入：

```json
{
  "dependencies": {
    "dsh-md-preview": "github:poiuyjie/dsh-md-preview"
  }
}
```

然后在 `cordis.patch.yml` 中启用：

```yaml
- insert:
    - id: md-preview
      name: 'dsh-md-preview'
```

重启 `dsh web`，刷新页面即可在会话头部看到「MD 预览」按钮。

## 使用

1. 点击会话头部的「MD 预览」按钮打开面板；
2. 面板默认显示本会话最近访问的 `.md` 文件卡片（文件名 / 路径 / 操作历史 / 摘要）；
3. 点击对话消息流中的 `.md` 引用 → 右侧栏自动打开并加载该文件；
4. 拖动面板左缘分隔线调整宽度；点「浮动」切换为浮动窗口；点「✕」关闭；
5. 按住 Ctrl/Cmd/Shift 点击引用 → 用系统默认编辑器打开。

## 开发

```bash
# 插件本体（Host 半边 + Client 半边均为纯 JS，无构建步骤）
ls index.js client.js
```

- `index.js`：Host 半边。监听 `fs/observed` 记录 md 文件访问（按会话隔离），提供 `/md-preview/api/{recent,read,peek}` 三个 HTTP 端点
- `client.js`：Client 半边。面板 UI、点击拦截（document 捕获阶段识别 md 引用按钮）、右侧停靠 + 布局让位

## 许可

[MIT](LICENSE)
