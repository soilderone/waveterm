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

    "onboarding.upgrade.v0121.intro":
        "补丁版本，专注于 Shell 集成改进、Wave AI 增强，并恢复了代码编辑器块中的语法高亮。",
    "onboarding.upgrade.v0121.sectionShell": "Shell 集成与上下文",
    "onboarding.upgrade.v0121.termOsc7": "OSC 7 支持",
    "onboarding.upgrade.v0121.descOsc7":
        "Wave 现可自动跟踪并在重启后恢复当前目录，支持 bash、zsh、fish 和 pwsh",
    "onboarding.upgrade.v0121.termShellCtx": "Shell 上下文跟踪",
    "onboarding.upgrade.v0121.descShellCtx":
        "跟踪 Shell 就绪状态、上次执行的命令和退出码，实现更好的终端管理",
    "onboarding.upgrade.v0121.sectionWaveAi": "Wave AI 改进",
    "onboarding.upgrade.v0121.aiReasoning": "等待 AI 响应时显示推理摘要",
    "onboarding.upgrade.v0121.aiContext":
        "增强的终端上下文——AI 现在可以访问 Shell 状态、当前目录、命令历史和退出码",
    "onboarding.upgrade.v0121.aiFeedback": "为 AI 响应新增了反馈按钮（赞/踩）",
    "onboarding.upgrade.v0121.aiCopy": "新增复制按钮，可轻松将 AI 响应复制到剪贴板",
    "onboarding.upgrade.v0121.sectionOther": "其他变更",
    "onboarding.upgrade.v0121.otherMobile": "网页小组件支持移动端 UA 模拟",
    "onboarding.upgrade.v0121.otherPadding": "修复了代码编辑器标题栏按钮的内边距",
    "onboarding.upgrade.v0121.otherHighlight": "恢复了代码编辑器预览块中的语法高亮",

    "onboarding.upgrade.v0122.intro":
        "Wave AI 现在可以创建和修改文件，并提供可视化 diff 预览和便捷的回滚功能。此外还有性能改进和错误修复。",
    "onboarding.upgrade.v0122.sectionFileEdit": "Wave AI 文件编辑",
    "onboarding.upgrade.v0122.termFileWrite": "文件写入工具",
    "onboarding.upgrade.v0122.descFileWrite": "Wave AI 经你批准后即可创建和修改文件",
    "onboarding.upgrade.v0122.termDiff": "可视化 Diff 预览",
    "onboarding.upgrade.v0122.descDiff": "在批准编辑之前准确查看将要发生的变化",
    "onboarding.upgrade.v0122.termRollback": "便捷回滚",
    "onboarding.upgrade.v0122.descRollback": "通过简单的“Revert File”按钮撤销文件更改",
    "onboarding.upgrade.v0122.sectionAdditional": "其他 AI 改进",
    "onboarding.upgrade.v0122.aiDragDrop": "可将文件从预览查看器直接拖放到 Wave AI",
    "onboarding.upgrade.v0122.aiDirPre": "目录列表支持",
    "onboarding.upgrade.v0122.aiDirPost": "命令",
    "onboarding.upgrade.v0122.aiThinking": "每个对话可调节思考级别和最大输出 token 数",
    "onboarding.upgrade.v0122.aiToolDesc": "改进了工具描述和输入校验",
    "onboarding.upgrade.v0122.sectionBugs": "错误修复与改进",
    "onboarding.upgrade.v0122.bugRpc": "修复了 RPC 系统中严重的内存泄漏",
    "onboarding.upgrade.v0122.bugSchema": "恢复了配置文件 schema 校验",
    "onboarding.upgrade.v0122.bugPwsh": "修复了 PowerShell 5.x 回退问题",

    "onboarding.upgrade.v0123.intro":
        "Wave AI 模型升级到 GPT-5.1，新增密钥管理功能，并改进了交互式 CLI 工具的终端输入处理。",
    "onboarding.upgrade.v0123.sectionWaveAi": "Wave AI 更新",
    "onboarding.upgrade.v0123.termGpt": "GPT-5.1 模型",
    "onboarding.upgrade.v0123.descGpt": "升级到 OpenAI 的 GPT-5.1 模型，响应质量更高",
    "onboarding.upgrade.v0123.termThinking": "思考模式切换",
    "onboarding.upgrade.v0123.descThinking": "新增下拉菜单，可在 Quick、Balanced 和 Deep 思考模式之间选择",
    "onboarding.upgrade.v0123.aiBackupFix": "修复了恢复 AI 写入文件备份时的路径不匹配问题",
    "onboarding.upgrade.v0123.sectionTerminal": "终端改进",
    "onboarding.upgrade.v0123.termInput": "增强的输入处理",
    "onboarding.upgrade.v0123.descInput": "更好地支持 Claude Code 等 CLI 工具",
    "onboarding.upgrade.v0123.termImage": "图片粘贴支持",
    "onboarding.upgrade.v0123.descImage": "可将图片直接粘贴到终端（保存为临时文件）",
    "onboarding.upgrade.v0123.termShiftEnter": "Shift+Enter 现在默认插入换行，方便输入多行命令",
    "onboarding.upgrade.v0123.termIme": "修复了切换输入法（IME）时的文本重复问题",
    "onboarding.upgrade.v0123.sectionSecret": "密钥存储",
    "onboarding.upgrade.v0123.termSecretWidget": "密钥管理小组件",
    "onboarding.upgrade.v0123.descSecretWidget": "安全地存储和管理敏感凭据",
    "onboarding.upgrade.v0123.secretCliPre": "通过 CLI 使用",
    "onboarding.upgrade.v0123.secretCliPost": "命令访问密钥",

    "onboarding.upgrade.v0130.intro":
        "Wave v0.13 带来了本地 AI 支持、自带密钥（BYOK）、重新设计的配置系统以及改进的终端功能。",
    "onboarding.upgrade.v0130.sectionLocal": "本地 AI 与 BYOK",
    "onboarding.upgrade.v0130.termApi": "兼容 OpenAI 的 API",
    "onboarding.upgrade.v0130.descApi": "可连接 Ollama、LM Studio、vLLM、OpenRouter 及其他本地或托管模型",
    "onboarding.upgrade.v0130.termGemini": "Google Gemini",
    "onboarding.upgrade.v0130.descGemini": "原生支持 Gemini 模型",
    "onboarding.upgrade.v0130.termPresets": "服务商预设",
    "onboarding.upgrade.v0130.descPresets": "内置 OpenAI、OpenRouter、Google、Azure 及自定义端点的配置",
    "onboarding.upgrade.v0130.termModes": "多种 AI 模式",
    "onboarding.upgrade.v0130.descModes": "轻松在不同模型和服务商之间切换",
    "onboarding.upgrade.v0130.sectionConfig": "配置小组件",
    "onboarding.upgrade.v0130.termConfigUi": "全新配置界面",
    "onboarding.upgrade.v0130.descConfigUi": "可从侧边栏访问的专用小组件",
    "onboarding.upgrade.v0130.termOrg": "更好的组织方式",
    "onboarding.upgrade.v0130.descOrg": "浏览和编辑设置，校验和错误处理更完善",
    "onboarding.upgrade.v0130.termSecrets": "集成密钥管理",
    "onboarding.upgrade.v0130.descSecrets": "在配置小组件中管理 API 密钥和凭据",
    "onboarding.upgrade.v0130.sectionTerminal": "终端更新",
    "onboarding.upgrade.v0130.termBracket": "括号粘贴模式",
    "onboarding.upgrade.v0130.descBracket": "默认启用，多行粘贴行为更好",
    "onboarding.upgrade.v0130.termWinPaste": "Windows 粘贴修复",
    "onboarding.upgrade.v0130.descWinPaste": "Ctrl+V 在 Windows 上现在可作为标准粘贴使用",
    "onboarding.upgrade.v0130.termSsh": "SSH 密码存储",
    "onboarding.upgrade.v0130.descSsh": "将 SSH 密码存储在 Wave 的密钥库中",

    "onboarding.upgrade.v0131.intro":
        "Wave v0.13.1 专注于 Windows 平台改进、Wave AI 视觉更新和增强的终端导航。",
    "onboarding.upgrade.v0131.sectionWindows": "Windows 平台增强",
    "onboarding.upgrade.v0131.termLayout": "一体化窗口布局",
    "onboarding.upgrade.v0131.descLayout": "控件集成到标签栏标题中，界面更简洁",
    "onboarding.upgrade.v0131.termGitBash": "Git Bash 自动检测",
    "onboarding.upgrade.v0131.descGitBash": "自动检测 Git Bash 安装",
    "onboarding.upgrade.v0131.termSshAgent": "SSH Agent 回退",
    "onboarding.upgrade.v0131.descSshAgent": "改进了 Windows 上的 SSH agent 支持",
    "onboarding.upgrade.v0131.termFocusKey": "更新的聚焦快捷键",
    "onboarding.upgrade.v0131.descFocusKey": "Windows 上 Wave AI 聚焦键改为 Alt:0",
    "onboarding.upgrade.v0131.sectionWaveAi": "Wave AI 更新",
    "onboarding.upgrade.v0131.termVisual": "全新视觉设计",
    "onboarding.upgrade.v0131.descVisual": "完整的 UI 焕新，支持自定义背景的透明效果",
    "onboarding.upgrade.v0131.termByok": "BYOK 无需遥测",
    "onboarding.upgrade.v0131.descByok": "Wave AI 使用自带密钥和本地模型时不再需要遥测",
    "onboarding.upgrade.v0131.sectionTerminal": "终端改进",
    "onboarding.upgrade.v0131.termScroll": "新的滚动快捷键",
    "onboarding.upgrade.v0131.descScroll":
        "新增 Shift+Home、Shift+End、Shift+PageUp 和 Shift+PageDown，便于导航",

    "onboarding.upgrade.v0140.intro":
        "Wave v0.14 引入了 Durable Sessions（持久会话）。启用后，即使遇到网络中断、电脑休眠和重启，远程会话也能保持运行——连接恢复后会自动重连。",
    "onboarding.upgrade.v0140.sectionDurable": "持久 SSH 会话",
    "onboarding.upgrade.v0140.seeDocs": "[查看文档]",
    "onboarding.upgrade.v0140.termSessionProtection": "会话保护",
    "onboarding.upgrade.v0140.descSessionProtection": "断连后程序与 shell 状态依然保留",
    "onboarding.upgrade.v0140.termVisualStatus": "可视化状态指示",
    "onboarding.upgrade.v0140.descVisualStatus": "盾牌图标显示会话状态",
    "onboarding.upgrade.v0140.termFlexibleConfig": "灵活的配置",
    "onboarding.upgrade.v0140.descFlexibleConfig": "可全局、按连接或按终端启用",
    "onboarding.upgrade.v0140.sectionConnection": "增强的连接监控",
    "onboarding.upgrade.v0140.termKeepalives": "连接保活",
    "onboarding.upgrade.v0140.descKeepalives": "通过保活探针主动监控",
    "onboarding.upgrade.v0140.termStalledDetection": "停滞连接检测",
    "onboarding.upgrade.v0140.descStalledDetection": "网络问题可视化反馈",
    "onboarding.upgrade.v0140.sectionAi": "Wave AI 更新",
    "onboarding.upgrade.v0140.termImageSupport": "图片支持",
    "onboarding.upgrade.v0140.descImageSupport": "为 BYOK 提供商提供视觉能力",
    "onboarding.upgrade.v0140.termStopGeneration": "停止生成",
    "onboarding.upgrade.v0140.descStopGeneration": "可在生成中途停止 AI 回复",
    "onboarding.upgrade.v0140.termAutoScrolling": "改进的自动滚动",
    "onboarding.upgrade.v0140.sectionTerminal": "终端改进",
    "onboarding.upgrade.v0140.termContextMenu": "增强的右键菜单",
    "onboarding.upgrade.v0140.descContextMenu": "快速访问分屏、主题等功能",
    "onboarding.upgrade.v0140.termOsc52": "OSC 52 剪贴板支持",
    "onboarding.upgrade.v0140.descOsc52": "命令行应用可复制到系统剪贴板",

    "onboarding.upgrade.v0141.intro":
        "Wave v0.14.1 修复了几个高影响的终端问题，并新增了焦点、光标样式和块导航相关的配置项。",
    "onboarding.upgrade.v0141.sectionTerminalFixes": "终端修复",
    "onboarding.upgrade.v0141.termClaudeScroll": "Claude Code 滚动修复",
    "onboarding.upgrade.v0141.descClaudeScroll": "修复了终端意外滚动跳动的问题",
    "onboarding.upgrade.v0141.termImeFix": "IME 修复",
    "onboarding.upgrade.v0141.descImeFix": "修复了韩文/CJK 输入丢字或粘字的问题",
    "onboarding.upgrade.v0141.termScrollPosition": "调整大小时保持滚动位置",
    "onboarding.upgrade.v0141.descScrollPosition": "调整窗口大小时终端保持在底部",
    "onboarding.upgrade.v0141.termScrollbackSave": "终端回滚保存",
    "onboarding.upgrade.v0141.scrollbackSavePre": "新增右键菜单项和",
    "onboarding.upgrade.v0141.scrollbackSavePost": "命令，可将回滚内容保存到文件",
    "onboarding.upgrade.v0141.sectionConfig": "新增配置项",
    "onboarding.upgrade.v0141.termFocusCursor": "焦点跟随光标",
    "onboarding.upgrade.v0141.focusCursorPre": "新增",
    "onboarding.upgrade.v0141.focusCursorPost": "设置（off/on/term）",
    "onboarding.upgrade.v0141.termCursorStyle": "终端光标样式与闪烁",
    "onboarding.upgrade.v0141.descCursorStyle": "可按块配置光标形状和闪烁",
    "onboarding.upgrade.v0141.termVimNav": "Vim 风格块导航",
    "onboarding.upgrade.v0141.descVimNav": "用 Ctrl+Shift+H/J/K/L 在块之间导航",
    "onboarding.upgrade.v0141.termAiProviders": "新增 AI 提供商",
    "onboarding.upgrade.v0141.descAiProviders": "新增 Groq 和 NanoGPT 内置预设",

    "onboarding.upgrade.v0142.intro":
        "Wave v0.14.2 引入了全新的块徽章系统，可一目了然地查看状态，同时改进了目录预览并修复了问题。v0.14.3 是一个补丁版本，修复了新手引导中的一个严重问题。",
    "onboarding.upgrade.v0142.sectionBadges": "块与标签页徽章",
    "onboarding.upgrade.v0142.termBadgesRollup": "块徽章汇总到标签页",
    "onboarding.upgrade.v0142.descBadgesRollup":
        "块可以显示图标徽章（含颜色和优先级），并在标签栏中可见，一眼了解状态",
    "onboarding.upgrade.v0142.termBellIndicator": "默认开启响铃指示",
    "onboarding.upgrade.v0142.bellIndicatorPre": "终端响铃时，响铃徽章会点亮块和标签页（由",
    "onboarding.upgrade.v0142.bellIndicatorPost": "控制）",
    "onboarding.upgrade.v0142.wshBadgeDesc":
        "新增命令，可从 CLI 设置或清除徽章。支持图标、颜色、优先级以及与 PID 关联的徽章",
    "onboarding.upgrade.v0142.termClaudeIntegration": "Claude Code 集成",
    "onboarding.upgrade.v0142.claudeIntegrationPre": "使用",
    "onboarding.upgrade.v0142.claudeIntegrationDescPost": "配合 Claude Code hooks，将 AI 任务状态显示为标签栏通知",
    "onboarding.upgrade.v0142.seeDocs": "[查看文档]",
    "onboarding.upgrade.v0142.sectionOther": "其他变更",
    "onboarding.upgrade.v0142.patchReleaseTerm": "[v0.14.3]",
    "onboarding.upgrade.v0142.patchReleaseDesc": "[bugfix] 修复了新手引导中的严重问题",
    "onboarding.upgrade.v0142.termDirectoryPreview": "目录预览",
    "onboarding.upgrade.v0142.descDirectoryPreview":
        "改进了修改时间格式、斑马纹行、更好的默认排序，并支持 YAML 文件",
    "onboarding.upgrade.v0142.termSearchBar": "搜索栏",
    "onboarding.upgrade.v0142.descSearchBar": "剪贴板与焦点改进",
    "onboarding.upgrade.v0142.bugfixNewWindow": "[bugfix] 修复了 GNOME 桌面上“新建窗口”卡死的问题",
    "onboarding.upgrade.v0142.bugfixSaveSession": "[bugfix] 修复了“将会话另存为…”焦点窗口跟踪问题",

    "onboarding.upgrade.v0144.intro":
        "Wave v0.14.4 引入了垂直标签页，升级到 xterm.js v6，并包含问题修复和 UI 改进。",
    "onboarding.upgrade.v0144.sectionVertical": "垂直标签栏",
    "onboarding.upgrade.v0144.termVerticalTab": "新增垂直标签栏选项",
    "onboarding.upgrade.v0144.descVerticalTab":
        "标签页现在可以沿窗口侧边垂直显示，腾出更多横向空间。可在设置中切换横向和纵向布局。",
    "onboarding.upgrade.v0144.sectionTerminal": "终端改进",
    "onboarding.upgrade.v0144.termXterm": "xterm.js v6.0.0 升级",
    "onboarding.upgrade.v0144.descXterm": "提升了终端兼容性和渲染效果，解决了 Claude Code 等工具的显示异常",
    "onboarding.upgrade.v0144.sectionOther": "其他变更",
    "onboarding.upgrade.v0144.termMacosClick": "macOS 首次点击",
    "onboarding.upgrade.v0144.descMacosClick": "首次点击现在会聚焦被点击的小组件",
    "onboarding.upgrade.v0144.backgroundsRenamePre": "已将",
    "onboarding.upgrade.v0144.backgroundsRenamePost": "重命名为",
    "onboarding.upgrade.v0144.termConfigErrors": "配置错误已迁移",
    "onboarding.upgrade.v0144.descConfigErrors": "配置错误移至 WaveConfig 视图，减少杂乱",
    "onboarding.upgrade.v0144.otherUnsaved": "WaveConfig 现会在有未保存更改时发出警告",
    "onboarding.upgrade.v0144.otherPreviewStreaming": "修复了图片/视频预览流问题",
    "onboarding.upgrade.v0144.otherLegacyAi": "已移除废弃的旧版 AI 小组件",
    "onboarding.upgrade.v0144.bugfixFocus": "[bugfix] 修复了新建块的焦点问题",

    "onboarding.upgrade.v0145.intro":
        "Wave v0.14.5 引入了全新的 Process Viewer（进程查看器）小组件、多项易用性改进，并修复了无法从 Settings（设置）小组件创建新配置文件的问题。",
    "onboarding.upgrade.v0145.sectionProcessViewer": "Process Viewer",
    "onboarding.upgrade.v0145.processViewerDesc":
        "全新小组件，可显示本地和远程机器上运行的进程，包含 CPU 和内存占用，并支持按列排序。",
    "onboarding.upgrade.v0145.sectionOther": "其他变更",
    "onboarding.upgrade.v0145.termQuake": "Quake Mode",
    "onboarding.upgrade.v0145.quakeDescPre": "——全局热键（",
    "onboarding.upgrade.v0145.quakeDescPost": "）现在可以切换 Wave 窗口的显示与隐藏",
    "onboarding.upgrade.v0145.termDragDrop": "将文件拖放到终端",
    "onboarding.upgrade.v0145.dragDropDesc": "以粘贴其带引号的路径",
    "onboarding.upgrade.v0145.splitButtonsPre": "新增",
    "onboarding.upgrade.v0145.splitButtonsPost": "设置，可在块标题栏添加分屏按钮",
    "onboarding.upgrade.v0145.otherSidebarToggle": "可从 View（视图）菜单打开或关闭小组件侧边栏",
    "onboarding.upgrade.v0145.otherF2Rename": "按 F2 重命名当前标签页",
    "onboarding.upgrade.v0145.otherMouseButtons": "鼠标前进/后退键现在可在网页小组件中导航",
    "onboarding.upgrade.v0145.bugfixTerm": "[bugfix]",
    "onboarding.upgrade.v0145.bugfixDesc": "尚不存在的配置文件无法从 Settings（设置）小组件创建或编辑的问题",
};
