## The agents

The tool prints the correct command for you, so you do not have to copy anything
from this table. It is here so you can see what is supported before you start.

| Agent           | Works | What you need                                                                            |
| --------------- | ----- | ---------------------------------------------------------------------------------------- |
| Claude Code     | Yes   | One command. Works with a subscription login, an Anthropic API key, or Google Vertex AI. |
| Codex           | Yes   | One flag. A subscription or an API key works.                                            |
| GitHub Copilot  | Yes   | Your normal subscription login.                                                          |
| OpenCode        | Yes   | One command, or a config file.                                                           |
| Pi              | Yes   | A config file. Pi has no base URL variable.                                              |
| OMP             | Yes   | A YAML config file. Point it at any backend.                                             |
| Gemini CLI      | Yes   | One command. The free Google login works.                                                |
| Antigravity CLI | Yes   | A config file and a real Gemini API key — see below.                                     |
| Junie           | Yes   | A config file, and a real API key pasted in — see below.                                 |
| Cursor CLI      | No    | Nothing can make it work. See below.                                                     |
| Amp             | No    | Nothing can make it work. See below.                                                     |

Any other provider — a local model server, or a smaller hosted one — works
through **Custom base URL** (see the [README](../README.md)) on any agent in this table except Cursor
and Amp.

### Claude Code on Google Vertex AI

If your Claude Code already talks to Vertex AI (`CLAUDE_CODE_USE_VERTEX=1` is
set), pick **Google Vertex AI** at the provider question instead of
**Anthropic**. Vertex mode reads a different variable for a base-URL
override — `ANTHROPIC_VERTEX_BASE_URL`, not `ANTHROPIC_BASE_URL` — because
`ANTHROPIC_BASE_URL` belongs to the direct-API code path and is silently
ignored once Vertex mode is on. Picking **Anthropic** here while
`CLAUDE_CODE_USE_VERTEX=1` is set is the most common way a Vertex student's
logs folder stays empty with no error at all.

This route only covers `CLOUD_ML_REGION=global`, the default and most common
setting. A regional value (`us-east5`, say) talks to a different host and
is not wired up yet — ask for it via the issue tracker if you hit this.

### Antigravity CLI

Antigravity CLI (`agy`) is a separate Google product from Gemini CLI — a
different binary, a different agent harness — not a rebrand of it. Its API-key
route, though, stores its settings under Gemini CLI's own directory
(`~/.gemini/antigravity-cli/settings.json`) and calls the public Gemini API
directly, reading the exact same `GOOGLE_GEMINI_BASE_URL` variable Gemini
CLI's own API-key route reads. That means the existing `gemini` renderer
already reads this capture correctly — no new wire format was needed, only a
catalogue entry.

Two things must both be true before Antigravity CLI takes this route at all,
rather than falling back to its own account sign-in:

- `modelProvider` is `"gemini"` in the settings file the wizard writes for you, and
- `GEMINI_API_KEY` is exported in your shell — this tool does not set it, the
  same way it does not set `ANTHROPIC_API_KEY` for Claude Code's own API-key
  route.

Only this API-key route is covered. Antigravity CLI's default account
sign-in was not verified — Antigravity CLI is closed source, and public
reporting on the related Antigravity IDE suggests its account-login traffic
can go to a different, internal host rather than the Code Assist host Gemini
CLI's own free login uses. Ask for it via the issue tracker if you need it
logged.

### Junie

Junie is BYOK across several backends, with no fixed host of its own — the
same shape as OMP — so it goes through the base URL and wire format
questions like a custom target does, picking a real Anthropic-compatible or
OpenAI-compatible template depending which you choose. It writes a proxy
entry to `~/.junie/config.json` (user scope; a project-scope file at
`<project-root>/.junie/config.json` takes precedence if you have one — see
Junie's own docs), merged in alongside whatever else is already there.

Junie is the one agent here with no existing login for this tool to pass
through. Its custom-proxy mechanism bypasses JetBrains AI authentication
entirely, so the printed config carries a placeholder header line and you
paste in a real API key yourself — an Anthropic key on the
Anthropic-compatible route, an OpenAI key on the OpenAI-compatible one.
Treat that file the way you would any other file holding a real key: do not
commit it.

### Why Cursor and Amp cannot work

This is the most interesting thing in the whole lesson, so it is worth saying
clearly.

Some vendors build the system prompt **on your machine** and send it to the
model. You can read that, because it goes past your network card.

Some vendors build the system prompt **on their servers**. Your machine sends
your message and very little else. The prompt and the tool list are added after
your request arrives at their server.

Cursor and Amp are the second kind. Search the whole shipped Cursor bundle and
you will find no system prompt text and no tool schemas at all. No proxy can
read what your machine never sends. This is not a limit of this tool. It is a
property of the product.

If you use Cursor or Amp, install one of the other agents to follow the lesson.
