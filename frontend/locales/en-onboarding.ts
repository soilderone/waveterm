// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

export const enOnboarding: Record<string, string> = {
    "onboarding.welcome": "Welcome to Wave Terminal",
    "onboarding.supportGithub": "Support us on GitHub",
    "onboarding.openSourcePre": "We're ",
    "onboarding.openSourceLabel": "open source",
    "onboarding.openSourceMid": ", ",
    "onboarding.openModelLabel": "open-model",
    "onboarding.openSourcePost":
        ", and committed to providing a free terminal for individual users. Please show your support by giving us a star on ",
    "onboarding.openSourceTail": "",
    "onboarding.joinCommunity": "Join our Community",
    "onboarding.communityDesc":
        "Get help, submit feature requests, report bugs, or just chat with fellow terminal enthusiasts.",
    "onboarding.joinDiscord": "Join the Wave Discord Channel",
    "onboarding.telemetryDesc": "Anonymous usage data helps us improve features you use.",
    "onboarding.privacyPolicy": "Privacy Policy",
    "onboarding.telemetryEnabledLabel": "Enabled",
    "onboarding.telemetryDisabledLabel": "Disabled",
    "onboarding.continue": "Continue",
    "onboarding.telemetryDisabledTitle": "Telemetry Disabled ✓",
    "onboarding.privacyRespect": "No problem, we respect your privacy.",
    "onboarding.telemetryStarDesc":
        "But, without usage data, we're flying blind. A GitHub star helps us know Wave is useful and worth maintaining.",
    "onboarding.starOnGithub": "⭐ Star on GitHub",
    "onboarding.maybeLater": "Maybe Later",

    "onboarding.next": "Next",
    "onboarding.getStarted": "Get Started",
    "onboarding.prev": "Prev",
    "onboarding.stepOf": "{current} of {total}",
    "onboarding.skipFeatureTour": "Skip Feature Tour >",

    "onboarding.aiDesc":
        "Wave AI is your terminal assistant with context. I can read your terminal output, analyze widgets, read/write files, and help you solve problems faster.",
    "onboarding.aiTogglePre": "Toggle the Wave AI panel with the ",
    "onboarding.aiTogglePost": " button in the header (top left)",
    "onboarding.aiShortcutPre": "Or use the keyboard shortcut ",
    "onboarding.aiShortcutPost": " to quickly toggle",
    "onboarding.aiProviders":
        "Bring your own API keys or run local models with Ollama, LM Studio, and other OpenAI-compatible providers",
    "onboarding.magnifyTitle": "Magnify Blocks",
    "onboarding.magnifyDesc1":
        "Magnify any block to focus on what matters. Expand terminals, editors, and previews for a better view.",
    "onboarding.magnifyDesc2":
        "Use the magnify feature to work with complex outputs and large files more efficiently.",
    "onboarding.magnifyIconPre": "You can also magnify a block by clicking on the ",
    "onboarding.magnifyIconPost": " icon in the block header.",
    "onboarding.magnifyShortcut":
        "A quick {shortcut}-M to magnify and another {shortcut}-M to unmagnify",
    "onboarding.filesTitle": "Viewing/Editing Files",
    "onboarding.filesDescPre": "Wave can preview markdown, images, and video files on both local ",
    "onboarding.filesDescRemote": "and remote",
    "onboarding.filesDescPost": " machines.",
    "onboarding.filesViewPre": "Use ",
    "onboarding.filesViewPost": " to preview files in Wave's graphical viewer",
    "onboarding.filesEditPost": " to open config files or code files in Wave's graphical editor",
    "onboarding.filesNote":
        "These commands work seamlessly on both local and remote machines, making it easy to view and edit files wherever they are.",

    "onboarding.fakechat.thinking": "AI is thinking...",
    "onboarding.fakechat.readDir": 'reading directory "~/waveterm"',
    "onboarding.fakechat.readTerm": "reading terminal output from widget",
    "onboarding.fakechat.prompt1":
        "Check out ~/waveterm and summarize the project — what it does and how it's organized.",
    "onboarding.fakechat.response1": `Here's a quick, file-structure–driven overview of this repo (Wave Terminal):

## What it is
- Electron + React front end with a Go backend ("wavesrv"). Provides a terminal with GUI widgets, previews, web, and AI. (README.md)
- Licensed Apache-2.0. (LICENSE)

## Architecture at a glance
- **Electron main process:** \`emain/*.ts\` configures windows, menus, preload scripts, updater, and ties into the Go backend via local RPC. (\`emain/\`)
- **Renderer UI:** React/TS built with Vite, Tailwind. (\`frontend/\`, \`index.html\`, \`electron.vite.config.ts\`)
- **Go backend ("wavesrv"):** starts services, web and websocket listeners, telemetry loops, config watcher, local RPC, filestore and SQLite-backed object store. (\`cmd/server/main-server.go\`, \`pkg/*\`)
- **CLI/helper ("wsh"):** built for multiple OS/arch; used for shell integration and remote operations. (\`cmd/wsh/\`, \`Taskfile.yml build:wsh\`)

## Key directories
- **cmd/:** entrypoints and generators
  - \`server/\`: wavesrv main
  - \`generategs/\`, \`generatego/\`: TS/Go bindings generation
  - \`wsh/\`: shell helper

- **pkg/:** backend packages
  - \`wcore/\`: startup coordination, initial data, window/workspace creation
  - \`web/\`: HTTP+WS servers, Unix listener
  - \`waveai/\`: AI backends (OpenAI, Anthropic, Google, Perplexity)
  - \`wshrpc\`, \`wshutil\`, \`wslconn\`, \`remote/*\`: local/remote RPC, WSL, SSH, fileshare
  - \`wstore/\`: persistent store (SQLite via sqlx); \`waveobj/\`: object model
  - \`filestore/\`: local file cache/storage
  - \`telemetry/\`: metrics/events, periodic reporting`,
    "onboarding.fakechat.prompt2": "can you analyze the log output in my terminal?",
    "onboarding.fakechat.response2": `Here's what your log shows:

- Normal startup/init at 18:06:51 (router/register, DBGetAllObjsByType, Stat/Read).
- Many FocusWindow events — normal UI activity.
- 18:08:28.558 WebSocket ReadPump error: close 1001 (going away) — usually a tab/app reload, sleep, or brief network hiccup.
- 18:08:29 re-init + new WebSocket connection — successful auto-reconnect.
- SetMetaCommand and periodic filestore flushes with err: — normal; no failures.
- No panics/fatal errors; just the transient disconnect.

If that disconnect was unexpected, check for a tab reload/sleep at 18:08:28, and watch for repeats.

Want deeper triage? Run these and paste results:

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

Need me to look at a longer slice (e.g., last 1000 lines) or a different time range?`,
    "onboarding.fakechat.context": "Context",
    "onboarding.fakechat.widgetAccessOn": "Widget Access ON",
    "onboarding.fakechat.on": "ON",
    "onboarding.fakechat.moreOptions": "More options",

    "onboarding.shortcuts.title": "Keyboard Shortcuts",
    "onboarding.shortcuts.switchTabs": "Switch Tabs",
    "onboarding.shortcuts.switchTabsDesc": "Press {modKey} + Number (1-9) to quickly switch between tabs.",
    "onboarding.shortcuts.navigateBlocks": "Navigate Blocks",
    "onboarding.shortcuts.navigateBlocksDesc":
        "Use Ctrl-Shift + Arrow Keys (←→↑↓) to move between blocks in the current tab.",
    "onboarding.shortcuts.focusBlockDesc":
        "Use Ctrl-Shift + Number (1-9) to focus a specific block by its position.",

    "onboarding.durableTitle": "Durable SSH Sessions",
    "onboarding.durableBadge": "SSH Sessions, Protected",
    "onboarding.durableDesc1":
        "Close your laptop, switch networks, restart Wave — your remote sessions keep running.",
    "onboarding.durableDesc2": "Shell state, running programs, and terminal history are all preserved",
    "onboarding.durableDesc3": "Sessions automatically reconnect when your connection is restored",
    "onboarding.durableDesc4": "Buffered output streams back in, never miss a line",
    "onboarding.durableNote":
        "All the persistence of tmux, built into your terminal. Look for the shield icon to enable durability on any SSH session.",

    "onboarding.block.terminal": "Terminal",
    "onboarding.block.web": "Web",

    "onboarding.connected": "Connected",
    "onboarding.disconnected": "Disconnected",
    "onboarding.deploy.step1": "[1/8] Installing dependencies...",
    "onboarding.deploy.step2": "[2/8] Generating TypeScript types from Go...",
    "onboarding.deploy.step3": "[3/8] Building Go backend (wavesrv)...",
    "onboarding.deploy.step4": "[4/8] Compiling TypeScript frontend...",
    "onboarding.deploy.step5": "[5/8] Bundling Electron renderer...",
    "onboarding.deploy.step6": "[6/8] Packaging application artifacts...",
    "onboarding.deploy.step7": "[7/8] Code signing binaries...",
    "onboarding.deploy.step8": "[8/8] Deploy complete ✓",

    "onboarding.starAskTitle": "Support open-source. Star Wave. ⭐",
    "onboarding.starAskDesc":
        "Wave is free, open-source, and open-model. Stars help us stay visible against closed alternatives. One click makes a difference.",
    "onboarding.alreadyStarred": "🙏 Already Starred",
    "onboarding.starNow": "⭐ Star Now",

    "onboarding.upgrade.welcomeVersion": "Welcome to Wave {version}!",
    "onboarding.upgrade.aiDesc":
        "Wave AI is your terminal assistant with full context. It can read your terminal output, analyze widgets, read and write files, and help you solve problems faster.",
    "onboarding.upgrade.newInVersion": "New in {version}:",
    "onboarding.upgrade.aiLocalModels":
        "Wave AI now supports local models and bring-your-own-key! Use Ollama, LM Studio, vLLM, OpenRouter, or any OpenAI-compatible provider.",
    "onboarding.upgrade.durableSessions":
        "Durable SSH sessions survive network drops, laptop sleep, and restarts — all without tmux or screen.",
    "onboarding.upgrade.thanks": "Thanks for being an early Wave adopter! ⭐",
    "onboarding.upgrade.starDesc":
        "A GitHub star shows your support for Wave (and open-source) and helps us reach more developers.",

    "onboarding.upgrade.versionUpdate": "Wave {version} Update",
    "onboarding.upgrade.next.v0122": "Next (v0.12.2)",
    "onboarding.upgrade.next.v0123": "Next (v0.12.3)",
    "onboarding.upgrade.next.v0130": "Next (v0.13.0)",
    "onboarding.upgrade.next.v0131": "Next (v0.13.1)",
    "onboarding.upgrade.next.v0140": "Next (v0.14.0)",
    "onboarding.upgrade.next.v0141": "Next (v0.14.1)",
    "onboarding.upgrade.next.v0143": "Next (v0.14.3)",
    "onboarding.upgrade.next.v0144": "Next (v0.14.4)",
    "onboarding.upgrade.next.v0145": "Next (v0.14.5)",
    "onboarding.upgrade.prev.v0121": "Prev (v0.12.1)",
    "onboarding.upgrade.prev.v0122": "Prev (v0.12.2)",
    "onboarding.upgrade.prev.v0125": "Prev (v0.12.5)",
    "onboarding.upgrade.prev.v0130": "Prev (v0.13.0)",
    "onboarding.upgrade.prev.v0131": "Prev (v0.13.1)",
    "onboarding.upgrade.prev.v0140": "Prev (v0.14.0)",
    "onboarding.upgrade.prev.v0141": "Prev (v0.14.1)",
    "onboarding.upgrade.prev.v0143": "Prev (v0.14.3)",
    "onboarding.upgrade.prev.v0144": "Prev (v0.14.4)",

    "onboarding.upgrade.v0121.intro":
        "Patch release focused on shell integration improvements, Wave AI enhancements, and restoring syntax highlighting in code editor blocks.",
    "onboarding.upgrade.v0121.sectionShell": "Shell Integration & Context",
    "onboarding.upgrade.v0121.termOsc7": "OSC 7 Support",
    "onboarding.upgrade.v0121.descOsc7":
        "Wave now automatically tracks and restores your current directory across restarts for bash, zsh, fish, and pwsh shells",
    "onboarding.upgrade.v0121.termShellCtx": "Shell Context Tracking",
    "onboarding.upgrade.v0121.descShellCtx":
        "Tracks when your shell is ready, last command executed, and exit codes for better terminal management",
    "onboarding.upgrade.v0121.sectionWaveAi": "Wave AI Improvements",
    "onboarding.upgrade.v0121.aiReasoning": "Display reasoning summaries while waiting for AI responses",
    "onboarding.upgrade.v0121.aiContext":
        "Enhanced terminal context - AI now has access to shell state, current directory, command history, and exit codes",
    "onboarding.upgrade.v0121.aiFeedback": "Added feedback buttons (thumbs up/down) for AI responses",
    "onboarding.upgrade.v0121.aiCopy": "Added copy button to easily copy AI responses to clipboard",
    "onboarding.upgrade.v0121.sectionOther": "Other Changes",
    "onboarding.upgrade.v0121.otherMobile": "Mobile user agent emulation support for web widgets",
    "onboarding.upgrade.v0121.otherPadding": "Fixed padding for header buttons in code editor",
    "onboarding.upgrade.v0121.otherHighlight": "Restored syntax highlighting in code editor preview blocks",

    "onboarding.upgrade.v0122.intro":
        "Wave AI can now create and modify files with visual diff previews and easy rollback capabilities. Plus performance improvements and bug fixes.",
    "onboarding.upgrade.v0122.sectionFileEdit": "Wave AI File Editing",
    "onboarding.upgrade.v0122.termFileWrite": "File Write Tool",
    "onboarding.upgrade.v0122.descFileWrite": "Wave AI can now create and modify files with your approval",
    "onboarding.upgrade.v0122.termDiff": "Visual Diff Preview",
    "onboarding.upgrade.v0122.descDiff": "See exactly what will change before approving edits",
    "onboarding.upgrade.v0122.termRollback": "Easy Rollback",
    "onboarding.upgrade.v0122.descRollback": "Revert file changes with a simple \"Revert File\" button",
    "onboarding.upgrade.v0122.sectionAdditional": "Additional AI Improvements",
    "onboarding.upgrade.v0122.aiDragDrop": "Drag & drop files from preview viewer directly to Wave AI",
    "onboarding.upgrade.v0122.aiDirPre": "Directory listings support in",
    "onboarding.upgrade.v0122.aiDirPost": "commands",
    "onboarding.upgrade.v0122.aiThinking": "Adjustable thinking level and max output tokens per chat",
    "onboarding.upgrade.v0122.aiToolDesc": "Improved tool descriptions and input validations",
    "onboarding.upgrade.v0122.sectionBugs": "Bug Fixes & Improvements",
    "onboarding.upgrade.v0122.bugRpc": "Fixed significant memory leak in the RPC system",
    "onboarding.upgrade.v0122.bugSchema": "Config file schema validation restored",
    "onboarding.upgrade.v0122.bugPwsh": "Fixed PowerShell 5.x regression",

    "onboarding.upgrade.v0123.intro":
        "Wave AI model upgrade to GPT-5.1, new secret management features, and improved terminal input handling for interactive CLI tools.",
    "onboarding.upgrade.v0123.sectionWaveAi": "Wave AI Updates",
    "onboarding.upgrade.v0123.termGpt": "GPT-5.1 Model",
    "onboarding.upgrade.v0123.descGpt": "Upgraded to OpenAI's GPT-5.1 model for improved responses",
    "onboarding.upgrade.v0123.termThinking": "Thinking Mode Toggle",
    "onboarding.upgrade.v0123.descThinking":
        "New dropdown to select between Quick, Balanced, and Deep thinking modes",
    "onboarding.upgrade.v0123.aiBackupFix": "Fixed path mismatch issue when restoring AI write file backups",
    "onboarding.upgrade.v0123.sectionTerminal": "Terminal Improvements",
    "onboarding.upgrade.v0123.termInput": "Enhanced Input Handling",
    "onboarding.upgrade.v0123.descInput": "Better support for CLI tools like Claude Code",
    "onboarding.upgrade.v0123.termImage": "Image Paste Support",
    "onboarding.upgrade.v0123.descImage": "Paste images directly into terminal (saved to temp files)",
    "onboarding.upgrade.v0123.termShiftEnter":
        "Shift+Enter now inserts newlines by default for multi-line commands",
    "onboarding.upgrade.v0123.termIme": "Fixed duplicate text issue when switching input methods (IME)",
    "onboarding.upgrade.v0123.sectionSecret": "Secret Store",
    "onboarding.upgrade.v0123.termSecretWidget": "Secret Management Widget",
    "onboarding.upgrade.v0123.descSecretWidget": "Store and manage sensitive credentials securely",
    "onboarding.upgrade.v0123.secretCliPre": "Access secrets via CLI with",
    "onboarding.upgrade.v0123.secretCliPost": "commands",

    "onboarding.upgrade.v0130.intro":
        "Wave v0.13 brings local AI support, bring-your-own-key (BYOK), a redesigned configuration system, and improved terminal functionality.",
    "onboarding.upgrade.v0130.sectionLocal": "Local AI & BYOK",
    "onboarding.upgrade.v0130.termApi": "OpenAI-Compatible API",
    "onboarding.upgrade.v0130.descApi":
        "Connect to Ollama, LM Studio, vLLM, OpenRouter, and other local or hosted models",
    "onboarding.upgrade.v0130.termGemini": "Google Gemini",
    "onboarding.upgrade.v0130.descGemini": "Native support for Gemini models",
    "onboarding.upgrade.v0130.termPresets": "Provider Presets",
    "onboarding.upgrade.v0130.descPresets":
        "Built-in configs for OpenAI, OpenRouter, Google, Azure, and custom endpoints",
    "onboarding.upgrade.v0130.termModes": "Multiple AI Modes",
    "onboarding.upgrade.v0130.descModes": "Easily switch between models and providers",
    "onboarding.upgrade.v0130.sectionConfig": "Configuration Widget",
    "onboarding.upgrade.v0130.termConfigUi": "New Config Interface",
    "onboarding.upgrade.v0130.descConfigUi": "Dedicated widget accessible from the sidebar",
    "onboarding.upgrade.v0130.termOrg": "Better Organization",
    "onboarding.upgrade.v0130.descOrg":
        "Browse and edit settings with improved validation and error handling",
    "onboarding.upgrade.v0130.termSecrets": "Integrated Secrets",
    "onboarding.upgrade.v0130.descSecrets": "Manage API keys and credentials from the config widget",
    "onboarding.upgrade.v0130.sectionTerminal": "Terminal Updates",
    "onboarding.upgrade.v0130.termBracket": "Bracketed Paste Mode",
    "onboarding.upgrade.v0130.descBracket": "Enabled by default for better multi-line paste behavior",
    "onboarding.upgrade.v0130.termWinPaste": "Windows Paste Fix",
    "onboarding.upgrade.v0130.descWinPaste": "Ctrl+V now works as standard paste on Windows",
    "onboarding.upgrade.v0130.termSsh": "SSH Password Storage",
    "onboarding.upgrade.v0130.descSsh": "Store SSH passwords in Wave's secret store",

    "onboarding.upgrade.v0131.intro":
        "Wave v0.13.1 focuses on Windows platform improvements, Wave AI visual updates, and enhanced terminal navigation.",
    "onboarding.upgrade.v0131.sectionWindows": "Windows Platform Enhancements",
    "onboarding.upgrade.v0131.termLayout": "Integrated Window Layout",
    "onboarding.upgrade.v0131.descLayout":
        "Cleaner interface with controls integrated into the tab-bar header",
    "onboarding.upgrade.v0131.termGitBash": "Git Bash Auto-Detection",
    "onboarding.upgrade.v0131.descGitBash": "Automatically detects Git Bash installations",
    "onboarding.upgrade.v0131.termSshAgent": "SSH Agent Fallback",
    "onboarding.upgrade.v0131.descSshAgent": "Improved SSH agent support on Windows",
    "onboarding.upgrade.v0131.termFocusKey": "Updated Focus Keybinding",
    "onboarding.upgrade.v0131.descFocusKey": "Wave AI focus key changed to Alt:0 on Windows",
    "onboarding.upgrade.v0131.sectionWaveAi": "Wave AI Updates",
    "onboarding.upgrade.v0131.termVisual": "Refreshed Visual Design",
    "onboarding.upgrade.v0131.descVisual":
        "Complete UI refresh with transparency support for custom backgrounds",
    "onboarding.upgrade.v0131.termByok": "BYOK Without Telemetry",
    "onboarding.upgrade.v0131.descByok":
        "Wave AI now works with bring-your-own-key and local models without requiring telemetry",
    "onboarding.upgrade.v0131.sectionTerminal": "Terminal Improvements",
    "onboarding.upgrade.v0131.termScroll": "New Scrolling Keybindings",
    "onboarding.upgrade.v0131.descScroll":
        "Added Shift+Home, Shift+End, Shift+PageUp, and Shift+PageDown for better navigation",

    "onboarding.upgrade.v0140.intro":
        "Wave v0.14 introduces Durable Sessions. Enable them to keep your remote sessions alive through network interruptions, computer sleep, and restarts — they'll automatically reconnect when your connection is restored.",
    "onboarding.upgrade.v0140.sectionDurable": "Durable SSH Sessions",
    "onboarding.upgrade.v0140.seeDocs": "[see docs]",
    "onboarding.upgrade.v0140.termSessionProtection": "Session Protection",
    "onboarding.upgrade.v0140.descSessionProtection": "Programs and shell state survive disconnects",
    "onboarding.upgrade.v0140.termVisualStatus": "Visual Status Indicators",
    "onboarding.upgrade.v0140.descVisualStatus": "Shield icons show status",
    "onboarding.upgrade.v0140.termFlexibleConfig": "Flexible Configuration",
    "onboarding.upgrade.v0140.descFlexibleConfig": "Enable globally, per-connection, or per-terminal",
    "onboarding.upgrade.v0140.sectionConnection": "Enhanced Connection Monitoring",
    "onboarding.upgrade.v0140.termKeepalives": "Connection Keepalives",
    "onboarding.upgrade.v0140.descKeepalives": "Active monitoring with keepalive probes",
    "onboarding.upgrade.v0140.termStalledDetection": "Stalled Connection Detection",
    "onboarding.upgrade.v0140.descStalledDetection": "Visual feedback for network issues",
    "onboarding.upgrade.v0140.sectionAi": "Wave AI Updates",
    "onboarding.upgrade.v0140.termImageSupport": "Image Support",
    "onboarding.upgrade.v0140.descImageSupport": "Vision capabilities for BYOK providers",
    "onboarding.upgrade.v0140.termStopGeneration": "Stop Generation",
    "onboarding.upgrade.v0140.descStopGeneration": "Ability to stop AI responses mid-generation",
    "onboarding.upgrade.v0140.termAutoScrolling": "Improved Auto-scrolling",
    "onboarding.upgrade.v0140.sectionTerminal": "Terminal Improvements",
    "onboarding.upgrade.v0140.termContextMenu": "Enhanced Context Menu",
    "onboarding.upgrade.v0140.descContextMenu": "Quick access to splits, themes, and more",
    "onboarding.upgrade.v0140.termOsc52": "OSC 52 Clipboard Support",
    "onboarding.upgrade.v0140.descOsc52": "CLI apps can copy to system clipboard",

    "onboarding.upgrade.v0141.intro":
        "Wave v0.14.1 fixes several high-impact terminal bugs and adds new config options for focus, cursor style, and block navigation.",
    "onboarding.upgrade.v0141.sectionTerminalFixes": "Terminal Fixes",
    "onboarding.upgrade.v0141.termClaudeScroll": "Claude Code Scroll Fix",
    "onboarding.upgrade.v0141.descClaudeScroll": "Fixed unexpected terminal scroll jumps",
    "onboarding.upgrade.v0141.termImeFix": "IME Fix",
    "onboarding.upgrade.v0141.descImeFix": "Fixed Korean/CJK input losing or sticking characters",
    "onboarding.upgrade.v0141.termScrollPosition": "Scroll Position on Resize",
    "onboarding.upgrade.v0141.descScrollPosition": "Terminal stays at bottom across resizes",
    "onboarding.upgrade.v0141.termScrollbackSave": "Terminal Scrollback Save",
    "onboarding.upgrade.v0141.scrollbackSavePre": "New context menu item and",
    "onboarding.upgrade.v0141.scrollbackSavePost": "command to save scrollback to a file",
    "onboarding.upgrade.v0141.sectionConfig": "New Config Options",
    "onboarding.upgrade.v0141.termFocusCursor": "Focus Follows Cursor",
    "onboarding.upgrade.v0141.focusCursorPre": "New",
    "onboarding.upgrade.v0141.focusCursorPost": "setting (off/on/term)",
    "onboarding.upgrade.v0141.termCursorStyle": "Terminal Cursor Style & Blink",
    "onboarding.upgrade.v0141.descCursorStyle": "Configure cursor shape and blink per-block",
    "onboarding.upgrade.v0141.termVimNav": "Vim-Style Block Navigation",
    "onboarding.upgrade.v0141.descVimNav": "Ctrl+Shift+H/J/K/L to navigate blocks",
    "onboarding.upgrade.v0141.termAiProviders": "New AI Providers",
    "onboarding.upgrade.v0141.descAiProviders": "Added Groq and NanoGPT as built-in presets",

    "onboarding.upgrade.v0142.intro":
        "Wave v0.14.2 introduces a new block badge system for at-a-glance status, along with directory preview improvements and bug fixes. v0.14.3 is a patch release fixing a showstopper bug in onboarding.",
    "onboarding.upgrade.v0142.sectionBadges": "Block & Tab Badges",
    "onboarding.upgrade.v0142.termBadgesRollup": "Block Badges Roll Up to Tabs",
    "onboarding.upgrade.v0142.descBadgesRollup":
        "Blocks can display icon badges (with color and priority) that are visible in the tab bar for at-a-glance status",
    "onboarding.upgrade.v0142.termBellIndicator": "Bell Indicator On by Default",
    "onboarding.upgrade.v0142.bellIndicatorPre":
        "Terminal bell badge now lights up the block and tab when your terminal rings (controlled by",
    "onboarding.upgrade.v0142.bellIndicatorPost": ")",
    "onboarding.upgrade.v0142.wshBadgeDesc":
        "New command to set or clear badges from the CLI. Supports icons, colors, priorities, and PID-linked badges",
    "onboarding.upgrade.v0142.termClaudeIntegration": "Claude Code Integration",
    "onboarding.upgrade.v0142.claudeIntegrationPre": "Use",
    "onboarding.upgrade.v0142.claudeIntegrationDescPost":
        "with Claude Code hooks to surface AI task status as tab bar notifications",
    "onboarding.upgrade.v0142.seeDocs": "[see docs]",
    "onboarding.upgrade.v0142.sectionOther": "Other Changes",
    "onboarding.upgrade.v0142.patchReleaseTerm": "[v0.14.3]",
    "onboarding.upgrade.v0142.patchReleaseDesc": "[bugfix] Fixed a showstopper onboarding bug",
    "onboarding.upgrade.v0142.termDirectoryPreview": "Directory Preview",
    "onboarding.upgrade.v0142.descDirectoryPreview":
        "Improved mod time formatting, zebra-striped rows, better default sort, and YAML file support",
    "onboarding.upgrade.v0142.termSearchBar": "Search Bar",
    "onboarding.upgrade.v0142.descSearchBar": "Clipboard and focus improvements",
    "onboarding.upgrade.v0142.bugfixNewWindow": "[bugfix] Fixed \"New Window\" hanging on GNOME desktops",
    "onboarding.upgrade.v0142.bugfixSaveSession":
        "[bugfix] Fixed \"Save Session As...\" focused window tracking bug",

    "onboarding.upgrade.v0144.intro":
        "Wave v0.14.4 introduces vertical tabs, upgrades to xterm.js v6, and includes bug fixes and UI improvements.",
    "onboarding.upgrade.v0144.sectionVertical": "Vertical Tab Bar",
    "onboarding.upgrade.v0144.termVerticalTab": "New Vertical Tab Bar Option",
    "onboarding.upgrade.v0144.descVerticalTab":
        "Tabs can now be displayed vertically along the side of the window for more horizontal space. Toggle between horizontal and vertical layouts in settings.",
    "onboarding.upgrade.v0144.sectionTerminal": "Terminal Improvements",
    "onboarding.upgrade.v0144.termXterm": "xterm.js v6.0.0 Upgrade",
    "onboarding.upgrade.v0144.descXterm":
        "Improved terminal compatibility and rendering, resolving quirks with tools like Claude Code",
    "onboarding.upgrade.v0144.sectionOther": "Other Changes",
    "onboarding.upgrade.v0144.termMacosClick": "macOS First Click",
    "onboarding.upgrade.v0144.descMacosClick": "First click now focuses the clicked widget",
    "onboarding.upgrade.v0144.backgroundsRenamePre": "Renamed",
    "onboarding.upgrade.v0144.backgroundsRenamePost": "to",
    "onboarding.upgrade.v0144.termConfigErrors": "Config Errors Moved",
    "onboarding.upgrade.v0144.descConfigErrors": "Config errors to the WaveConfig view for less clutter",
    "onboarding.upgrade.v0144.otherUnsaved": "WaveConfig now warns on Unsaved Changes",
    "onboarding.upgrade.v0144.otherPreviewStreaming": "Preview streaming fixes for images/videos",
    "onboarding.upgrade.v0144.otherLegacyAi": "Deprecated legacy AI widget has been removed",
    "onboarding.upgrade.v0144.bugfixFocus": "[bugfix] Fixed focus bug for newly created blocks",

    "onboarding.upgrade.v0145.intro":
        "Wave v0.14.5 introduces a new Process Viewer widget, several quality-of-life improvements, and a fix for creating new config files from the Settings widget.",
    "onboarding.upgrade.v0145.sectionProcessViewer": "Process Viewer",
    "onboarding.upgrade.v0145.processViewerDesc":
        "New widget that displays running processes on local and remote machines, with CPU and memory usage and sortable columns.",
    "onboarding.upgrade.v0145.sectionOther": "Other Changes",
    "onboarding.upgrade.v0145.termQuake": "Quake Mode",
    "onboarding.upgrade.v0145.quakeDescPre": "— global hotkey (",
    "onboarding.upgrade.v0145.quakeDescPost": ") now toggles a Wave window visible and invisible",
    "onboarding.upgrade.v0145.termDragDrop": "Drag & Drop Files into Terminal",
    "onboarding.upgrade.v0145.dragDropDesc": "to paste their quoted path",
    "onboarding.upgrade.v0145.splitButtonsPre": "New",
    "onboarding.upgrade.v0145.splitButtonsPost": "setting adds split buttons to block headers",
    "onboarding.upgrade.v0145.otherSidebarToggle": "Toggle the widgets sidebar on and off from the View menu",
    "onboarding.upgrade.v0145.otherF2Rename": "F2 to rename the active tab",
    "onboarding.upgrade.v0145.otherMouseButtons": "Mouse back/forward buttons now navigate in web widgets",
    "onboarding.upgrade.v0145.bugfixTerm": "[bugfix]",
    "onboarding.upgrade.v0145.bugfixDesc":
        "Config files that didn't exist yet couldn't be created or edited from the Settings widget",
};
