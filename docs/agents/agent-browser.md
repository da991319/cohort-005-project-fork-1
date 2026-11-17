# Giving the agent a browser

This is how you drive a page in the app, and ask it questions.

It uses [agent-browser](https://github.com/vercel-labs/agent-browser), a CLI
built for exactly this — one command per action, an answer on stdout.

## Once, per machine

```bash
npm install -g agent-browser
agent-browser install
```

The factory workflows (`.github/workflows/agent-*.yml`) install it before the
agent starts, so a factory run can skip this step.

## Signing in as a Student

Most pages need a user. Pick one the way the DevUI panel does, by posting to
`/api/switch-user`. In the seeded database, user 5 (Emma Wilson) is a
Student enrolled in `introduction-to-typescript`, whose first lesson is 1:

```bash
agent-browser open http://localhost:5173/
agent-browser eval 'fetch("/api/switch-user", { method: "POST", body: new URLSearchParams({ userId: "5" }) }).then((r) => r.status)'
agent-browser open http://localhost:5173/courses/introduction-to-typescript/lessons/1
```

Users 1–4 are the admin and three instructors. For any other combination of
user and course, query `data.db` for it rather than guessing.

## A "before" screenshot

`sh scripts/serve-base.sh` serves `origin/main` on port 5174, from a
throwaway worktree, beside your own dev server. Take the "before" there and the
"after" on 5173. Run it in the background and stop it when you are done; it
removes its worktree on exit. Pass another ref and port as arguments:
`sh scripts/serve-base.sh <ref> <port>`.

## Asking your own question

Start the app with `npm run dev` first. The examples below use
`http://localhost:5173`, the dev server's default address — if `npm run dev`
printed a different one, use that.

A screenshot is pixels. To verify a fix you need a yes or a no, so read the
DOM:

```bash
agent-browser open http://localhost:5173/courses
agent-browser find placeholder "Search courses..." fill "typescript"
agent-browser find role button click --name "Search"

# Did the search reach the URL?
agent-browser get url

# How many course cards came back?
agent-browser get count 'a[href^="/courses/"]'

# What does the empty state say, if there is one?
agent-browser get text main

# Did anything break?
agent-browser errors
agent-browser console
```

The commands worth knowing: `open`, `click`, `fill`,
`find <role|text|label|placeholder> …`, `wait`, `get text|html|attr|count|url`,
`is visible|enabled|checked`, `eval`, `snapshot` (the accessibility tree, with
refs), `screenshot`, `console`, `errors`, `close`. `agent-browser --help` has
the rest.

**Ask the page, do not ask the person.** A change you have not looked at is a
change you are reporting on trust.

Screenshots are PR evidence: a before and an after for a change that shows in
the UI.

## Two things that will bite you

**Hydration lags "networkidle".** The button is in the server HTML before
React attaches its `onClick`, so the first click can be a silent no-op. Poll
for the click's effect and click again, rather than waiting a fixed time.

**Vite re-optimizes on the first load.** On a fresh checkout, the first page
load discovers dependencies Vite has not pre-bundled, and pushes a full-page
reload a moment after the response has finished. Absorb it once against a
throwaway load before the real loop; otherwise it lands mid-interaction and
every click after it hits a page that is already navigating away.
