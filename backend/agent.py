"""Arvo Code: the coding agent used by the Arvo desktop app.

The desktop app runs the tools on the user's own computer (reading and
writing files, running commands). This server only talks to the model: it
receives the conversation so far, adds Arvo's system prompt and the tool
definitions, and returns the model's next message, which may ask for tools.
The Groq key never leaves the server.
"""

from __future__ import annotations

import json

AGENT_SYSTEM_PROMPT_TEMPLATE = """
You are ARVO Code, the coding agent inside the Arvo desktop app. ARVO was made by Kayi Berisa.
If asked who made you, say Kayi Berisa. Never claim to be ChatGPT, GPT, Qwen or Llama, or to be made by OpenAI, Alibaba or Meta.

You work inside one project folder on the user's own computer, chosen by the user (the "workspace").
It is a real folder, not a virtual or sandboxed copy: files you write are saved on the user's computer right away,
and commands you run, run on the user's computer. Never tell the user your files are "virtual" or need copying over.
You can look at it and change it with tools:
- list_files: see what is in a folder.
- read_files: read several files at once. Use this instead of reading files one by one.
- read_file: read part of one big file (a range of lines).
- search_files: find text across the project.
- write_files: create or replace several files at once. Use this to write a whole feature or project in one step.
- write_file: create a file or replace a whole file.
- edit_file: replace one exact piece of text in a file. Prefer this over write_file for small changes.
- run_command: run a shell command in the workspace (installing packages, running tests, building, git).

Do the work yourself:
- You have hands: use your tools to do what the user asks. Don't give the user commands to paste, scripts to save,
  or steps to follow when you can do them yourself with write_files, edit_file or run_command.
- If something is needed (a package, a folder, a config file), install it or create it yourself.
- Only ask the user to do things you truly can't: signing in, typing a password, physical actions,
  or clicking inside another app. Then say exactly what to do.

{BATCH}How to work:
1. Look before you change anything: list and read the files that matter. Never guess what a file contains.
2. Make focused changes that do what the user asked, in the style the project already uses.
3. After changing code, check it when you can: run the tests, the build, or the program.
4. If a command fails, read the error, fix the cause, and try again. Don't repeat the same failing command.
5. When you are done, reply with a short summary of what you changed and what you checked. Say plainly if something is not done or not verified.

Rules:
- Paths are relative to the workspace. You cannot touch files outside it.
- The user approves edits and commands, and may decline. If they decline, don't retry the same thing; ask what they want instead.
- Never print, log or commit secrets such as API keys, passwords or .env contents.
- Don't run destructive commands (deleting many files, force-pushing, formatting disks) unless the user clearly asked.
- Commands run without a terminal to type into, so avoid ones that wait for input; pass flags like --yes instead.
{LONG_RUNNING}
- Apps you create are built with Expo (React Native) and TypeScript, unless the user asks otherwise.
- Keep replies short and use Markdown. Show code in replies only when it helps; the files are what matter.
""".strip()

BATCH_PROMPT = """Work fast, in as few steps as possible. Every step is a round trip, so:
- Read everything you need in one step (read_files with all the paths, or several tool calls together).
- Write the files for a change together with write_files (up to about 5 files per call; for more, make several write_files calls in the same reply), complete and working, not one file per step.
- You may call several tools in the same reply; they run together.
- Don't re-read files you just wrote, and don't list folders you have already seen.

"""
LONG_RUNNING_OLD = "- Long-running servers (npm run dev and similar) never finish; don't start them unless asked, and tell the user how to run them instead."
LONG_RUNNING_BACKGROUND = (
    "- Programs that keep running (dev servers, apps with a window, bots, remotes) never finish. To start one, "
    "call run_command with background: true. You get what it printed in its first seconds, and it keeps running. "
    "When the user asks you to run, start or open their program, start it this way instead of telling them how, "
    'for example run_command with {"command": "python app.py", "background": true}. '
    "Only say a program is running if the result says it is still running."
)


def system_prompt(batch: bool, background: bool) -> str:
    """Arvo's instructions, matched to what this app version can do."""
    text = AGENT_SYSTEM_PROMPT_TEMPLATE.replace("{BATCH}", BATCH_PROMPT if batch else "")
    text = text.replace("{LONG_RUNNING}", LONG_RUNNING_BACKGROUND if background else LONG_RUNNING_OLD)
    if not batch:
        text = "\n".join(line for line in text.split("\n") if not line.startswith(("- read_files:", "- write_files:")))
    return text


AGENT_SYSTEM_PROMPT = system_prompt(batch=True, background=True)


def _tool(name: str, description: str, properties: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


_PATH = {"type": "string", "description": "Path relative to the workspace, for example src/App.tsx. Use . for the workspace itself."}

AGENT_TOOLS = [
    _tool("list_files", "List the files and folders in a folder of the workspace.", {"path": _PATH}, ["path"]),
    _tool(
        "read_file",
        "Read a text file. Lines are numbered. For big files, read a range of lines.",
        {
            "path": _PATH,
            "start_line": {"type": "integer", "description": "First line to read, starting at 1."},
            "end_line": {"type": "integer", "description": "Last line to read."},
        },
        ["path"],
    ),
    _tool(
        "read_files",
        "Read several text files at once (up to 12). Lines are numbered.",
        {"paths": {"type": "array", "items": {"type": "string"}, "description": "Paths relative to the workspace."}},
        ["paths"],
    ),
    _tool(
        "search_files",
        "Search the workspace for text (case-insensitive). Returns matching lines with their file and line number.",
        {
            "query": {"type": "string", "description": "Text to look for."},
            "path": {"type": "string", "description": "Folder to search in. Defaults to the whole workspace."},
        },
        ["query"],
    ),
    _tool(
        "write_file",
        "Create a file, or replace a file's entire contents. Folders are created as needed.",
        {"path": _PATH, "content": {"type": "string", "description": "The complete new contents of the file."}},
        ["path", "content"],
    ),
    _tool(
        "write_files",
        "Create or replace several files at once (up to 30). Folders are created as needed.",
        {
            "files": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Path relative to the workspace."},
                        "content": {"type": "string", "description": "The complete contents of the file."},
                    },
                    "required": ["path", "content"],
                },
            }
        },
        ["files"],
    ),
    _tool(
        "edit_file",
        "Replace one exact piece of text in a file. old_text must appear exactly once; include enough surrounding lines to make it unique.",
        {
            "path": _PATH,
            "old_text": {"type": "string", "description": "The exact text to replace, including spaces and indentation."},
            "new_text": {"type": "string", "description": "The text to put in its place."},
        },
        ["path", "old_text", "new_text"],
    ),
    _tool(
        "run_command",
        "Run a shell command in the workspace and return its output. Stops after 5 minutes (15 for installs and builds).",
        {
            "command": {"type": "string", "description": "The command to run."},
            "cwd": {"type": "string", "description": "Folder to run it in, relative to the workspace. Defaults to the workspace."},
        },
        ["command"],
    ),
]

_BACKGROUND = {
    "type": "boolean",
    "description": "Start a program that keeps running (a dev server or an app) and leave it running. Returns its first few seconds of output.",
}

TOOL_NAMES = {t["function"]["name"] for t in AGENT_TOOLS}

READ_ONLY_TOOLS = [t for t in AGENT_TOOLS if t["function"]["name"] in {"list_files", "read_file", "read_files", "search_files"}]
BATCH_TOOLS = {"read_files", "write_files"}


def tools_for(mode: str, batch: bool, background: bool = False) -> list[dict]:
    """Tools for this request. Older app versions don't have every tool or option."""
    tools = READ_ONLY_TOOLS if mode == "plan" else AGENT_TOOLS
    if not batch:
        tools = [t for t in tools if t["function"]["name"] not in BATCH_TOOLS]
    if background:
        tools = [_with_background(t) if t["function"]["name"] == "run_command" else t for t in tools]
    return tools


def _with_background(tool: dict) -> dict:
    fn = tool["function"]
    params = {**fn["parameters"], "properties": {**fn["parameters"]["properties"], "background": _BACKGROUND}}
    return {"type": "function", "function": {**fn, "parameters": params}}

PLAN_MODE_PROMPT = """
PLAN MODE IS ON. You can only look at the project (list, read, search); you cannot edit files or run commands yet.
Explore what you need, then reply with a clear, numbered plan: which files you will create or change, what each change does,
which commands you will run, and how you will check the result. Keep it short. Do not write the full code yet.
The user will approve the plan, and then you will carry it out.
""".strip()

# Each request carries the whole conversation, and Groq's free plan allows
# about 8,000 tokens a minute per model. The instructions and tool list take
# about 2,000 tokens, so the conversation is kept to roughly 2,500 more
# (about 4 characters a token). Smaller steps mean fewer waits.
AGENT_CHAR_BUDGET = 10_000
# No single tool result may be bigger than this, even the newest one.
MAX_TOOL_OUTPUT_CHARS = 8_000
# Older tool results are first shortened to this, and only removed if the
# conversation is still too big.
SHORT_TOOL_OUTPUT_CHARS = 600
MAX_STEPS_PER_TURN = 40
TRIMMED = "[Older output removed to save space. Run the tool again if you need it.]"


def _clip_middle(text: str, limit: int) -> str:
    """Keep the start and end of a long text; the end of command output is often the error."""
    if len(text) <= limit:
        return text
    head = limit * 3 // 4
    tail = limit - head
    return f"{text[:head]}\n[... {len(text) - limit} characters cut to save space ...]\n{text[-tail:]}"


def _size(message: dict) -> int:
    size = len(message.get("content") or "")
    for call in message.get("tool_calls") or []:
        size += len(call.get("function", {}).get("arguments") or "")
    return size


def trim_messages(messages: list[dict]) -> list[dict]:
    """Shrink the oldest tool outputs and file writes until the conversation fits.

    Messages are never dropped, so every tool call keeps its matching result.
    """
    messages = [dict(m) for m in messages]
    for message in messages:
        if message["role"] == "tool":
            message["content"] = _clip_middle(message.get("content") or "", MAX_TOOL_OUTPUT_CHARS)
    total = sum(_size(m) for m in messages)
    # Leave the latest step alone (the model's last tool calls and their
    # results); the model is working on those.
    last_assistant = max((i for i, m in enumerate(messages) if m["role"] == "assistant"), default=len(messages))
    older = messages[:last_assistant]
    # First pass: shorten older tool results but keep their start, so the
    # model still remembers roughly what it saw.
    for message in older:
        if total <= AGENT_CHAR_BUDGET:
            break
        content = message.get("content") or ""
        if message["role"] == "tool" and len(content) > SHORT_TOOL_OUTPUT_CHARS + 200:
            short = content[:SHORT_TOOL_OUTPUT_CHARS] + "\n[... rest removed to save space. Run the tool again if you need it.]"
            total -= len(content) - len(short)
            message["content"] = short
    # Second pass: remove older outputs and file contents completely.
    for message in older:
        if total <= AGENT_CHAR_BUDGET:
            break
        if message["role"] == "tool" and len(message.get("content") or "") > len(TRIMMED):
            total -= len(message["content"]) - len(TRIMMED)
            message["content"] = TRIMMED
        elif message["role"] == "assistant" and message.get("tool_calls"):
            calls = []
            for call in message["tool_calls"]:
                fn = call.get("function", {})
                args = fn.get("arguments") or ""
                if len(args) > 400 and fn.get("name") in ("write_file", "write_files", "edit_file"):
                    total -= len(args) - 2
                    fn = {**fn, "arguments": "{}"}
                calls.append({**call, "function": fn})
            message["tool_calls"] = calls
    return messages


def steps_since_user(messages: list[dict]) -> int:
    count = 0
    for message in reversed(messages):
        if message["role"] == "user":
            break
        if message["role"] == "assistant":
            count += 1
    return count


def clean_tool_calls(tool_calls: list[dict] | None) -> list[dict]:
    """Keep only well-formed calls to known tools, with JSON-string arguments."""
    out = []
    for call in tool_calls or []:
        fn = call.get("function") or {}
        args = fn.get("arguments")
        if not isinstance(args, str):
            args = json.dumps(args or {})
        out.append({
            "id": call.get("id") or f"call_{len(out)}",
            "type": "function",
            "function": {"name": fn.get("name", ""), "arguments": args},
        })
    return out


# Sent (as a note, not shown to the user) when the model's tool call could
# not be parsed, which usually means it tried to send too much at once.
TOOL_RETRY_HINT = (
    "(Note from the Arvo app: your last tool call could not be read, probably because it was too long "
    "or the JSON was broken. Try again with valid JSON and smaller calls: at most 3 files per write_files call.)"
)

EMPTY_REPLY_HINT = (
    "(Note from the Arvo app: your last reply was empty. Continue the task with tools. "
    "If it is finished, reply with a short summary of what you did.)"
)
