// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export const zhCNOnboarding: Record<string, string> = {
    "onboarding.welcome": "欢迎使用 Wave Terminal",
    "onboarding.supportGithub": "在 GitHub 上支持我们",
    "onboarding.openSourcePre": "我们",
    "onboarding.openSourceLabel": "开源",
    "onboarding.openSourceMid": "、",
    "onboarding.openModelLabel": "开放模型",
    "onboarding.openSourcePost": "，致力于为个人用户提供免费终端。请前往 ",
    "onboarding.openSourceTail": " 为我们点星支持。",
    "onboarding.joinCommunity": "加入我们的社区",
    "onboarding.communityDesc": "获取帮助、提交功能请求、报告问题，或与其他终端爱好者交流。",
    "onboarding.joinDiscord": "加入 Wave Discord 频道",
    "onboarding.telemetryDesc": "匿名使用数据有助于我们改进你常用的功能。",
    "onboarding.privacyPolicy": "隐私政策",
    "onboarding.telemetryEnabledLabel": "已启用",
    "onboarding.telemetryDisabledLabel": "已禁用",
    "onboarding.continue": "继续",
    "onboarding.telemetryDisabledTitle": "遥测已禁用 ✓",
    "onboarding.privacyRespect": "没问题，我们尊重你的隐私。",
    "onboarding.telemetryStarDesc":
        "但如果没有使用数据，我们就无从了解实际使用情况。在 GitHub 上点星能让我们知道 Wave 有用、值得继续维护。",
    "onboarding.starOnGithub": "⭐ 在 GitHub 上点星",
    "onboarding.maybeLater": "稍后再说",

    "onboarding.next": "下一步",
    "onboarding.getStarted": "开始使用",
    "onboarding.prev": "上一步",
    "onboarding.stepOf": "第 {current} 步，共 {total} 步",
    "onboarding.skipFeatureTour": "跳过功能导览 >",

    "onboarding.aiDesc":
        "Wave AI 是你的上下文终端助手。它可以读取终端输出、分析小组件、读写文件，帮助你更快解决问题。",
    "onboarding.aiTogglePre": "使用页眉（左上角）的 ",
    "onboarding.aiTogglePost": " 按钮切换 Wave AI 面板",
    "onboarding.aiShortcutPre": "或使用快捷键 ",
    "onboarding.aiShortcutPost": " 快速切换",
    "onboarding.aiProviders":
        "自带 API 密钥，或通过 Ollama、LM Studio 及其他兼容 OpenAI 的提供商运行本地模型",
    "onboarding.magnifyTitle": "放大块",
    "onboarding.magnifyDesc1": "放大任意块，专注于重要内容。展开终端、编辑器和预览，获得更好的视野。",
    "onboarding.magnifyDesc2": "使用放大功能，更高效地处理复杂输出和大文件。",
    "onboarding.magnifyIconPre": "你也可以点击块标题栏中的 ",
    "onboarding.magnifyIconPost": " 图标来放大块。",
    "onboarding.magnifyShortcut": "按 {shortcut}-M 快速放大，再按 {shortcut}-M 还原",
    "onboarding.filesTitle": "查看/编辑文件",
    "onboarding.filesDescPre": "Wave 可以在本地",
    "onboarding.filesDescRemote": "和远程",
    "onboarding.filesDescPost": "机器上预览 Markdown、图片和视频文件。",
    "onboarding.filesViewPre": "使用 ",
    "onboarding.filesViewPost": " 在 Wave 的图形化查看器中预览文件",
    "onboarding.filesEditPost": " 在 Wave 的图形化编辑器中打开配置文件或代码文件",
    "onboarding.filesNote":
        "这些命令在本地和远程机器上都能无缝使用，让你随时随地轻松查看和编辑文件。",

    "onboarding.fakechat.thinking": "AI 思考中…",
    "onboarding.fakechat.readDir": '正在读取目录 "~/waveterm"',
    "onboarding.fakechat.readTerm": "正在读取小组件的终端输出",
    "onboarding.fakechat.prompt1": "查看 ~/waveterm 并总结这个项目——它的功能和结构。",
    "onboarding.fakechat.response1": `以下是这个仓库基于文件结构的快速概览（Wave Terminal）：

## 项目简介
- Electron + React 前端，搭配 Go 后端（"wavesrv"）。提供带 GUI 小组件、预览、网页和 AI 的终端。（README.md）
- 采用 Apache-2.0 许可。（LICENSE）

## 架构一览
- **Electron 主进程：** \`emain/*.ts\` 负责窗口、菜单、预加载脚本、更新器，并通过本地 RPC 连接 Go 后端。（\`emain/\`）
- **渲染器 UI：** 使用 Vite、Tailwind 构建的 React/TS。（\`frontend/\`、\`index.html\`、\`electron.vite.config.ts\`）
- **Go 后端（"wavesrv"）：** 启动服务、Web 与 WebSocket 监听、遥测循环、配置监听、本地 RPC、文件存储以及基于 SQLite 的对象存储。（\`cmd/server/main-server.go\`、\`pkg/*\`）
- **CLI/辅助工具（"wsh"）：** 为多种操作系统/架构构建，用于 shell 集成和远程操作。（\`cmd/wsh/\`、\`Taskfile.yml build:wsh\`）

## 主要目录
- **cmd/：** 入口点和生成器
  - \`server/\`：wavesrv 主程序
  - \`generategs/\`、\`generatego/\`：TS/Go 绑定生成
  - \`wsh/\`：shell 辅助工具

- **pkg/：** 后端包
  - \`wcore/\`：启动协调、初始数据、窗口/工作区创建
  - \`web/\`：HTTP+WS 服务器、Unix 监听
  - \`waveai/\`：AI 后端（OpenAI、Anthropic、Google、Perplexity）
  - \`wshrpc\`、\`wshutil\`、\`wslconn\`、\`remote/*\`：本地/远程 RPC、WSL、SSH、文件共享
  - \`wstore/\`：持久化存储（通过 sqlx 使用 SQLite）；\`waveobj/\`：对象模型
  - \`filestore/\`：本地文件缓存/存储
  - \`telemetry/\`：指标/事件、定期上报`,
    "onboarding.fakechat.prompt2": "能分析一下我终端里的日志输出吗？",
    "onboarding.fakechat.response2": `以下是你的日志显示的内容：

- 18:06:51 正常启动/初始化（router/register、DBGetAllObjsByType、Stat/Read）。
- 大量 FocusWindow 事件——属于正常 UI 活动。
- 18:08:28.558 WebSocket ReadPump 错误：close 1001（going away）——通常是标签页/应用重载、休眠或短暂网络抖动。
- 18:08:29 重新初始化 + 新的 WebSocket 连接——自动重连成功。
- SetMetaCommand 以及带 err: 的周期性 filestore 刷新——正常，没有失败。
- 没有 panic/致命错误，只是短暂断连。

如果这次断连是意外发生的，请检查 18:08:28 是否有标签页重载/休眠，并留意是否重复出现。

需要更深入的排查吗？运行以下命令并粘贴结果：

\`\`\`bash
# 1) Scan recent logs for problems
grep -Ei 'error|panic|fatal|websocket|1006|1011' \\
  "$HOME/Library/Application Support/waveterm-dev/waveapp.log" | tail -n 200

# 2) Inspect around the disconnect window
awk '($0 ~ /2025-10-10 18:08:2[0-9]/){print}' \\
  "$HOME/Library/Application Support/waveterm-dev/waveapp.log"

# 3) Live follow for recurring drops
tail -f "$HOME/Library/Application Support/waveterm-dev/waveapp.log" \\
  | grep -Ei 'error|panic|fatal|websocket|close'
\`\`\`

需要我查看更长的一段（例如最后 1000 行）或不同的时间范围吗？`,
    "onboarding.fakechat.context": "上下文",
    "onboarding.fakechat.widgetAccessOn": "小组件访问已开启",
    "onboarding.fakechat.on": "开",
    "onboarding.fakechat.moreOptions": "更多选项",

    "onboarding.shortcuts.title": "键盘快捷键",
    "onboarding.shortcuts.switchTabs": "切换标签页",
    "onboarding.shortcuts.switchTabsDesc": "按 {modKey} + 数字（1-9）可快速切换标签页。",
    "onboarding.shortcuts.navigateBlocks": "在块之间导航",
    "onboarding.shortcuts.navigateBlocksDesc":
        "使用 Ctrl-Shift + 方向键（←→↑↓）在当前标签页的块之间移动。",
    "onboarding.shortcuts.focusBlockDesc": "使用 Ctrl-Shift + 数字（1-9）按位置聚焦特定块。",

    "onboarding.durableTitle": "持久 SSH 会话",
    "onboarding.durableBadge": "SSH 会话，受保护",
    "onboarding.durableDesc1": "合上笔记本、切换网络、重启 Wave——远程会话持续运行。",
    "onboarding.durableDesc2": "Shell 状态、运行中的程序和终端历史全部保留",
    "onboarding.durableDesc3": "连接恢复后会话自动重连",
    "onboarding.durableDesc4": "缓冲输出重新流入，一行都不会错过",
    "onboarding.durableNote":
        "tmux 的全部持久化能力，内置于你的终端。在任何 SSH 会话中寻找盾牌图标即可启用持久化。",

    "onboarding.block.terminal": "终端",
    "onboarding.block.web": "网页",

    "onboarding.connected": "已连接",
    "onboarding.disconnected": "已断开",
    "onboarding.deploy.step1": "[1/8] 正在安装依赖…",
    "onboarding.deploy.step2": "[2/8] 正在从 Go 生成 TypeScript 类型…",
    "onboarding.deploy.step3": "[3/8] 正在构建 Go 后端（wavesrv）…",
    "onboarding.deploy.step4": "[4/8] 正在编译 TypeScript 前端…",
    "onboarding.deploy.step5": "[5/8] 正在打包 Electron 渲染器…",
    "onboarding.deploy.step6": "[6/8] 正在打包应用制品…",
    "onboarding.deploy.step7": "[7/8] 正在对二进制文件进行代码签名…",
    "onboarding.deploy.step8": "[8/8] 部署完成 ✓",

    "onboarding.starAskTitle": "支持开源，为 Wave 点星。⭐",
    "onboarding.starAskDesc":
        "Wave 免费、开源且开放模型。点星能帮助我们在闭源竞品中保持可见。一次点击，意义重大。",
    "onboarding.alreadyStarred": "🙏 已点星",
    "onboarding.starNow": "⭐ 立即点星",

    "onboarding.upgrade.welcomeVersion": "欢迎使用 Wave {version}！",
    "onboarding.upgrade.aiDesc":
        "Wave AI 是全上下文的终端助手。它可以读取终端输出、分析小组件、读写文件，帮助你更快解决问题。",
    "onboarding.upgrade.newInVersion": "{version} 新功能：",
    "onboarding.upgrade.aiLocalModels":
        "Wave AI 现已支持本地模型和自带 API 密钥！可使用 Ollama、LM Studio、vLLM、OpenRouter 或任何兼容 OpenAI 的提供商。",
    "onboarding.upgrade.durableSessions":
        "持久 SSH 会话可经受网络中断、笔记本休眠和重启——无需 tmux 或 screen。",
    "onboarding.upgrade.thanks": "感谢你成为 Wave 的早期用户！⭐",
    "onboarding.upgrade.starDesc":
        "在 GitHub 点星能表达你对 Wave（以及开源）的支持，并帮助我们触达更多开发者。",

    "onboarding.upgrade.versionUpdate": "Wave {version} 更新",
    "onboarding.upgrade.next.v0122": "下一个（v0.12.2）",
    "onboarding.upgrade.next.v0123": "下一个（v0.12.3）",
    "onboarding.upgrade.next.v0130": "下一个（v0.13.0）",
    "onboarding.upgrade.next.v0131": "下一个（v0.13.1）",
    "onboarding.upgrade.next.v0140": "下一个（v0.14.0）",
    "onboarding.upgrade.next.v0141": "下一个（v0.14.1）",
    "onboarding.upgrade.next.v0143": "下一个（v0.14.3）",
    "onboarding.upgrade.next.v0144": "下一个（v0.14.4）",
    "onboarding.upgrade.next.v0145": "下一个（v0.14.5）",
    "onboarding.upgrade.prev.v0121": "上一个（v0.12.1）",
    "onboarding.upgrade.prev.v0122": "上一个（v0.12.2）",
    "onboarding.upgrade.prev.v0125": "上一个（v0.12.5）",
    "onboarding.upgrade.prev.v0130": "上一个（v0.13.0）",
    "onboarding.upgrade.prev.v0131": "上一个（v0.13.1）",
    "onboarding.upgrade.prev.v0140": "上一个（v0.14.0）",
    "onboarding.upgrade.prev.v0141": "上一个（v0.14.1）",
    "onboarding.upgrade.prev.v0143": "上一个（v0.14.3）",
    "onboarding.upgrade.prev.v0144": "上一个（v0.14.4）",
};
