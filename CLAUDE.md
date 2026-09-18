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

This working copy is used **only for reading, refining, and optimizing code**. Do not stand up a build environment in it.

- **Never install dependencies.** No `npm install` / `npm ci` / `yarn`, no `go mod download`, and never create `node_modules`. `npx <tool>` installs too — avoid it as well.
- **Never run builds, dev servers, or the app.** No `task package`, `electron-vite dev`, `npm run build:*`, `go build`, `go run`.
- **Verification happens on GitHub CI**, not locally. Push the branch and let the workflow handle typecheck, lint, test, and packaging.
- **Local checking is static only** — reading files, `grep`/`rg`, `git` inspection, and throwaway scripts that parse the source. Useful substitutes when no toolchain is present:
    - cross-check i18n keys used in code against `frontend/locales/en*.ts` and `zh-cn*.ts`, and check the two dictionaries for symmetry;
    - after a refactor, grep for identifiers that were renamed or deleted to catch dangling references;
    - bracket-balance the edited files.
- When a change genuinely cannot be validated without running something, **say so explicitly in the summary** instead of installing a toolchain to find out.
- If a tool was installed or a cache was populated by accident, clean it up in the same session and report what was removed.
