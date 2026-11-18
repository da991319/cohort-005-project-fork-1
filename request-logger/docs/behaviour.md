## The Observer Effect

Watching a thing can change the thing.

Claude Code trusts exactly one host. When you point it somewhere else, it turns
off tool search. That means it stops deferring tools and writes every tool
schema into the request instead. Your capture is then bigger than a real one and
has a different shape. That is the opposite of what you want from a tool whose
whole job is to show you the truth.

The command this tool prints for you sets `ENABLE_TOOL_SEARCH=true`, which turns
the effect off.

Measured through this tool with the same prompt:

| Run                            | Capture size |
| ------------------------------ | ------------ |
| Base URL only                  | 63,596 bytes |
| With `ENABLE_TOOL_SEARCH=true` | 39,013 bytes |

That is 39% smaller, and the tool-search tool appears only in the second
capture.

## What you get

Every request writes three files to `request-logger/logs/`, which is gitignored.
They share a base name such as `2026-07-07T14-32-05-123_claude-code`:

| File            | Contents                                 |
| --------------- | ---------------------------------------- |
| `.md`           | The readable render. Start here.         |
| `.request.txt`  | The request body exactly as it was sent. |
| `.response.txt` | The raw response stream.                 |

The `.md` file uses **XML tags** (`<request>`, `<system-prompt>`, `<tools>`,
`<messages>`, `<response>`) to mark its sections, because the captured content is
full of its own Markdown headings. It is complete and not truncated, so it is a
trustworthy readout of what the model received.

If you picked "not sure" for a custom base URL's wire format, the `.md` file
holds pretty-printed JSON instead of that fully tagged render — there is no
system prompt or tool section, because the tool was not told the shape needed
to find them. Nothing is lost: it is still the whole request and response, just
less readable. Run with `--force` and pick the real wire format once you know
it, and the tagged render takes over from the next request.

Secret headers (`authorization`, `x-api-key`, `api-key`) are hidden in the `.md`
file and are never written to the `.txt` files.

Some agents compress the request body. The `.md` file shows the decoded body so
that you can read it. The `.request.txt` file keeps the bytes exactly as they
were sent, so you can still replay it.

## How it works

- One process, one port, **one upstream host**. Your choice decides where
  requests go and how they are read. The tool does not guess from the URL,
  because several agents share the same URLs and guessing gets them wrong.
- Your real auth header passes through untouched, so your requests authenticate
  normally. The tool only reads a copy on the way past.
- Responses are **streamed straight back** as they arrive, so your agent behaves
  exactly as it would without the tool.

### One message is not one request

A single message you send is often **not** a single API request. A typical
Claude Code turn fans out into:

- **one** real generation call, which is the only one that produces a reply, and
  the one whose request holds the full system prompt and tools; and
- **many** token-counting calls, which are housekeeping. They measure sizes for
  the context bar, for caching and for compaction, and they return a number
  rather than model output.

Housekeeping calls carry no model output, so the tool **forwards them but does
not log them**. Your logs folder therefore holds real turns only. You still see a
`(housekeeping, not logged)` line in the console when they happen, so the fan-out
stays visible.

Different agents fan out differently, and that is worth watching:

- **OpenCode** never counts tokens. Instead it makes a second call with a small
  model to title the thread, so one turn writes exactly two captures.
- **Pi** never counts tokens at all, so every file is a real turn.
- **Gemini** on the free Google login makes several extra calls that carry no
  prompt. Those are not logged either.

### If your logs folder fills up in seconds

Some agents retry a failing call immediately and with no backoff. If the
call keeps failing the same way — a wrong base URL scheme, a bad model ID,
bad credentials — that turns into a tight loop of real requests, each one a
genuine POST the tool would otherwise write a full capture for. Left
unchecked, that is thousands of near-identical files in a few seconds.

Once the same method, path and status code repeats more than 20 times inside
2 seconds, this tool stops writing a capture for every repeat. It still
forwards every one of them untouched, so your agent is not affected; it just
stops filling your disk and your terminal with duplicates. You get one loud
warning naming the call and the likely causes, then a single summary line
every 500 repeats for as long as the loop continues.

The fix is always upstream of this tool: stop the agent, fix the base URL,
model ID or credentials, and start again. `omp` hitting `http://` instead of
`https://` on a provider's real API is the case this was built for — the
plaintext request gets rejected in milliseconds with no retry guidance in the
response, and some agents read that as "retry", not "give up."

## If your logs folder stays empty

The failure modes here are quiet ones. An empty folder looks the same whichever
of these happened:

1. **You changed agent and forgot to say so.** Run
   `npm run request-logger -- --force`. The line at the top of the console names
   the agent the tool currently thinks you use.
2. **Your agent chose a WebSocket.** This tool reads HTTP. Some Copilot models,
   and Pi's default transport, negotiate a WebSocket instead, and a WebSocket
   turn writes no log at all. The printed command sets the right transport where
   it can.
3. **You are signed in a way that goes around the tool.** A ChatGPT sign-in on
   OpenCode talks to a different host on purpose. Use an API key for that one.
   Codex is different: pick the ChatGPT route in the wizard and it works.
4. **You started your agent before setting the variable.** Agents read the
   variable once, at startup.
5. **You are on an older Codex, or following an older guide.** Codex used to
   read an OPENAI_BASE_URL variable. Version 0.133.0 does not. It ignores the
   variable in silence, so the only sign is an empty logs folder. Use the
   command this tool prints.

## How much this was tested

Be fair to the tool when you judge a failure.

- **Claude Code on the direct Anthropic API, and OMP, are tested end to end.**
  The measurements above are real, and OMP is run daily by the person who
  built this tool.
- **The others were verified** by reading the published code of each agent and
  by driving them against a local listener. They were not each run through a
  full course of the lesson. Claude Code on Google Vertex AI is in this
  group — verified against Anthropic's own Vertex documentation, not yet
  driven against a real Vertex project.
- **Junie is the least-verified entry in the catalogue.** Junie CLI is
  closed source, so unlike every other agent here its entry was not checked
  against real source, only against JetBrains' published Junie CLI docs
  (`config.json`, custom proxies, and CLI reference). It has not been driven
  against a real Junie install. If the proxy `kind`, the config file's
  precise shape, or the header format is wrong, that is the likely reason,
  and the fix is one line in `agents.ts`.
- **Antigravity CLI is verified against published docs only, the same way
  Junie is.** Antigravity CLI is also closed source. Its API-key route was
  checked against Google's own Antigravity CLI documentation (installation,
  authentication and the `GOOGLE_GEMINI_BASE_URL` variable), not against real
  source or a real install, and its account sign-in route was not verified
  at all — see "Antigravity CLI" in [agents.md](agents.md) for why that route is left out.
- **A custom base URL is only as tested as the agent it is attached to.** The
  base URL and wire format mechanism itself is tested directly (see
  `agents.test.ts`); a specific third-party server behind it has not
  necessarily been driven end to end.
- **Windows is not tested end to end either.** WSL and Git Bash need no
  special handling — they are POSIX shells, so they use the same command as
  Mac and Linux. Native PowerShell gets its own `$env:NAME = 'value'` syntax
  instead (see `withEnv` in `agents.ts`), verified by unit test but not by
  running a real agent against it on Windows. Command Prompt (`cmd.exe`) is
  not supported; use PowerShell, which is the default terminal in Windows
  Terminal and VS Code.

If one of them is wrong, it is worth reporting, and the fix is likely to be one
line in `agents.ts`.
