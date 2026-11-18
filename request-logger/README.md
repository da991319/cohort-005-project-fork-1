# request-logger

A small proxy with no dependencies. It sits between your coding agent and the
model provider's API, and writes a **readable Markdown document for every
request**: the real system prompt, the tool definitions, and the messages your
agent sends to the model.

It was built for the AI Coding Crash Course so that you can _see_ what actually
goes over the wire.

## Run it

```bash
npm run request-logger
```

The first time you run it, it asks which agent you use, then which model
provider you use with it. (OMP is the one exception: it has no fixed provider
of its own, so it skips straight to the base URL question below.) Last, it
asks whether to remember your answer. Say no if you swap agents often, and it
asks again every time. It then prints the exact command for your setup, and
starts listening.

It keeps listening until you stop it. Press **Ctrl+C** to stop it. The console
says so too.

Both questions end with **Other, or not sure**. Pick it if your setup is not in
the list, and the tool gives you a link to ask for it.

The provider question has a second way out, too: **Custom base URL**. Pick it
if your provider is not in the list but you know its base URL — a local model
server such as Ollama, or a smaller hosted provider such as DeepSeek, say. It
asks two questions instead of showing you a dead end:

- the base URL of the model server you want to log, for example
  `http://localhost:11434` for Ollama, or `https://api.deepseek.com` for
  DeepSeek; and
- which wire format it speaks — OpenAI-compatible, Anthropic-compatible, or
  "not sure", if you do not know.

If you are not sure, pick "not sure". The tool still logs everything; it just
shows you the raw JSON instead of a fully readable render, because it cannot
safely guess a shape you did not tell it. See "What you get" in
[docs/behaviour.md](docs/behaviour.md).

For **OpenCode** with an **OpenAI-compatible** custom target, and for **every**
**Pi** custom target, the wizard also tries the unauthenticated `/v1/models`
endpoint and offers any model IDs it finds. You can always enter an ID
manually, and the wizard falls back to manual entry if discovery fails.
Endpoints that require credentials for model listing are not supported.

- OpenCode's printed command uses a temporary `OPENCODE_CONFIG_CONTENT`
  provider for that one run, merged with your existing OpenCode configuration
  without editing its file.
- Pi has no such temporary option, so the selected model is written into
  `~/.pi/agent/models.json` alongside the base URL, replacing that provider's
  built-in model list with the one you chose. Without this, Pi would keep
  offering its built-in model names (`gpt-4o`, and the like), which almost
  never exist on a custom server — the agent would start but every turn would
  fail.
- Pi asks for a model on every wire format, including Anthropic-compatible —
  but discovery itself only ever checks the OpenAI-style `/v1/models` listing
  endpoint, which an Anthropic-compatible server often does not expose. If
  discovery finds nothing there, that is expected, and typing the model ID by
  hand is the normal path, not a sign something is broken.

To change a remembered answer:

```bash
npm run request-logger -- --force
```

This forgets the old answer first, then keeps the new one in its place. It does
not ask whether to remember, because you already said yes once. If you pick an
agent that cannot be logged, nothing is kept, and the old answer is gone too.

To use a different port:

```bash
PORT=9000 npm run request-logger
```

On Windows, run that in PowerShell (not Command Prompt) as:

```powershell
$env:PORT = 9000; npm run request-logger
```

A remembered answer is kept in `request-logger/.agent-choice.json`, which is
gitignored. It holds your choice only. The host, the renderer and the command are
worked out again on every start, so an update to this tool reaches you without
you having to clear anything.

The one exception is a **Custom base URL** answer. There is no catalogue entry
for it to be worked out from — you typed it — so the base URL and the wire
format you chose are saved in the file too, alongside your choice. OpenCode's
OpenAI-compatible custom route, and every Pi custom route, also save the
selected model ID, so a remembered choice starts without repeating discovery.
Everything else about a custom answer still behaves the same way: change it
any time with `--force`, and it is never kept for an agent that cannot be
logged.

## More

- [The agents](docs/agents.md): which agents work, and what each one needs.
- [Behaviour](docs/behaviour.md): the Observer Effect, what you get, how it works, troubleshooting, and how much this was tested.
- [Extending it](docs/extending.md): adding an agent or a wire format.
