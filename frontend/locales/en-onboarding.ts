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
};
