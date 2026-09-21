@.kilocode/rules/rules.md

---

## Skill Guides

This project uses a set of "skill" guides — focused how-to documents for common implementation tasks. When your task matches one of the descriptions below, **read the linked SKILL.md file before proceeding** and follow its instructions precisely.

| Skill        | File                                     | Description                                                                                                                                                                                                                                 |
| ------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| add-config   | `.kilocode/skills/add-config/SKILL.md`   | Guide for adding new configuration settings to Wave Terminal. Use when adding a new setting to the configuration system, implementing a new config key, or adding user-customizable settings.                                               |
| add-rpc      | `.kilocode/skills/add-rpc/SKILL.md`      | Guide for adding new RPC calls to Wave Terminal. Use when implementing new RPC commands, adding server-client communication methods, or extending the RPC interface with new functionality.                                                 |
| add-wshcmd   | `.kilocode/skills/add-wshcmd/SKILL.md`   | Guide for adding new wsh commands to Wave Terminal. Use when implementing new CLI commands, adding command-line functionality, or extending the wsh command interface.                                                                      |
| context-menu | `.kilocode/skills/context-menu/SKILL.md` | Guide for creating and displaying context menus in Wave Terminal. Use when implementing right-click menus, adding context menu items, creating submenus, or handling menu interactions with checkboxes and separators.                      |
| create-view  | `.kilocode/skills/create-view/SKILL.md`  | Guide for implementing a new view type in Wave Terminal. Use when creating a new view component, implementing the ViewModel interface, registering a new view type in BlockRegistry, or adding a new content type to display within blocks. |
| electron-api | `.kilocode/skills/electron-api/SKILL.md` | Guide for adding new Electron APIs to Wave Terminal. Use when implementing new frontend-to-electron communications via preload/IPC.                                                                                                         |
| waveenv      | `.kilocode/skills/waveenv/SKILL.md`      | Guide for creating WaveEnv narrowings in Wave Terminal. Use when writing a named subset type of WaveEnv for a component tree, documenting environmental dependencies, or enabling mock environments for preview/test server usage.          |
| wps-events   | `.kilocode/skills/wps-events/SKILL.md`   | Guide for working with Wave Terminal's WPS (Wave PubSub) event system. Use when implementing new event types, publishing events, subscribing to events, or adding asynchronous communication between components.                            |

---

## Local Workflow

Local debugging is **allowed for UI work**, on the condition that everything it installs or
generates is tracked and removed afterwards. The machine is disk-constrained — leaving build
output or toolchains behind is not acceptable.

- **Allowed:** `task dev` / `task electron:quickdev` (Electron + Vite HMR), `task preview`
  (standalone component preview server), `task generate`, and the `npm install` / toolchain
  installs those require.
- **Not allowed without asking:** `task package` and other full release builds, installing
  anything not needed by the two commands above.
- **Every install and every generated artifact goes in `LOCAL-DEV-TEARDOWN.md`** (repo root,
  untracked, listed in `.git/info/exclude`). That file holds the pre-install baseline, a running
  ledger of what was added, and the teardown procedure. Append to it as things are installed,
  not from memory afterwards.
- **Teardown when the UI work is done:** run the procedure in that ledger, then its verification
  block, and report what was removed. Paths marked pre-existing there (`docs/node_modules`,
  `tsunami/frontend/node_modules`, `~/.npm`, the installed app's data dirs) must survive intact.
- **CI still owns release verification.** Push the branch for typecheck / lint / packaging;
  local dev is for seeing the UI, not for proving the build is releasable.
- Static checks remain the cheap first pass — grep for dangling identifiers after a refactor,
  cross-check i18n keys between `frontend/locales/en*.ts` and `zh-cn*.ts`, bracket-balance
  edited files — do them before reaching for a dev server.
- When a change genuinely cannot be validated even locally, **say so explicitly in the summary**.
