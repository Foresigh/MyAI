# Arvo desktop (Arvo Code)

A desktop app where Arvo works in a project folder on your computer: it reads
your code, edits files and runs commands. Made by Kayi Berisa.

## How it works

- `electron/main.cjs` opens the window and keeps the settings and the coding session.
- `electron/agent.cjs` is the loop: it asks the Arvo server (`POST /agent/step`)
  for the next step, runs the tools Arvo asks for, and sends the results back.
  The Groq key stays on the server.
- `electron/tools.cjs` holds the tools: list, read, search, write, edit and run
  a command. Every path is checked to stay inside the chosen folder, and `.env`
  and key files are never read or written.
- `electron/permissions.cjs` decides what needs your OK in each mode:
  **Auto** (everyday work runs, risky commands like deleting files, `git push`
  or reading `.env` still ask), **Manual**, **Accept edits**, **Plan** (Arvo
  only looks, then proposes a plan you approve) and **Bypass permissions**
  (never asks; has to be enabled first). Shift+Tab switches modes.
- `electron/chats.cjs` saves every chat, so New chat never loses one; the
  History button reopens them.
- `src/` is the window (React).

## Updates

The app checks the GitHub releases of this repository for a newer version,
downloads it in the background and shows an **Update** button. To ship an
update: raise `version` in package.json, then run `npm run release` with a
GitHub token in `GH_TOKEN`. That builds the installer and publishes it as a
release, which every installed copy then picks up.

The model picker follows your plan, using the email in Settings: Free and Hobby
get Arvo 1.0, Pro and above get every model.

## Run it

```
npm install
npm run dev        # builds the window and opens the app
npm test           # checks the file and command tools
npm run dist       # makes the Windows installer in release/
```
