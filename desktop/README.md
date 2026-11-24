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
- `src/` is the window (React). Edits and commands show a preview with
  Allow / Always allow / Decline, unless you switch the approval mode.

The model picker follows your plan, using the email in Settings: Free and Hobby
get Arvo 1.0, Pro and above get every model.

## Run it

```
npm install
npm run dev        # builds the window and opens the app
npm test           # checks the file and command tools
npm run dist       # makes the Windows installer in release/
```
