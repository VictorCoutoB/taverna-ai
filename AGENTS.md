This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

# Taverna AI — project context for AI assistants (Codex, Gemini, Claude…)

The project owner is a non-programmer who speaks **Brazilian Portuguese**: always reply in pt-BR,
explain in plain language, and ask before anything irreversible (publishing, deleting, paid services).

**What it is:** an open-source (MIT) Android app, FableAI-style: an AI-narrated text adventure/RPG.
Each user brings their own AI (API key, or "Continue with ChatGPT" subscription login). No backend:
everything is stored on the device. Repo: https://github.com/VictorCoutoB/taverna-ai

**Read first:** `docs/CONTINUAR.md` (status, roadmap, how to run) and
`docs/superpowers/specs/2026-11-25-ai-rpg-design.md` (original design).

## Architecture (src/)
| Folder | Role |
|---|---|
| `app/` | Screens (Expo Router): `index` (library), `new` (create adventure), `game/[id]` (play), `settings`, `onboarding` |
| `engine/` | Deterministic game rules: d20 dice, character sheet, AI command validation (`commands.ts`), journal (`journal.ts`) |
| `narrator/` | Prompts, context building + token budget, response parser (`<choices>` / `<commands>` blocks), `runTurn` |
| `providers/` | AI adapters behind `TextProvider` / `ImageProvider` / `SpeechProvider` interfaces; `registry.ts` picks one from settings |
| `auth/` | "Sign in with ChatGPT" OAuth (PKCE, dynamic client, paste-the-callback-URL flow on mobile) |
| `storage/` | SQLite KV (localStorage on web), SecureStore for keys, images on disk, saves/branches, export/import |
| `state/` | Zustand stores: settings, model cache/favorites/recents |
| `ui/` | Components: ModelPicker, Story (book-style narration), JournalPanel, SavesPanel, BottomSheet, Cover… |
| `safety/` | Local content filter + report button (Play Store requirement) |

## Key rules
- The AI never changes game numbers directly: it emits JSON commands that `engine/` validates and applies.
- Narrator response format: narration, then `<choices>[3 strings]</choices>`, then `<commands>[...]</commands>`.
- Never commit API keys. Keys live only in SecureStore on the user's phone.
- Tests: `npx jest` (must pass), plus `npx tsc --noEmit` and `npx expo lint` before every commit.
- Dev-only hook to fake AI replies in the browser preview: `globalThis.__tavernaSetFetch(fn)` (see `src/providers/http.ts`).
- Git author: the repo uses the owner's GitHub noreply email; do not commit with any other identity.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
