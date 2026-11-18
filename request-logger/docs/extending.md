## Extending it

- **Add an agent:** add one entry to the catalogue in `agents.ts`, giving its
  upstream host, its renderer, its base URL suffix, and its command. That is the
  whole job. The wizard, the banner and the routing all read from there, so
  nothing else needs to change.
- **Add an agent with no fixed upstream at all**, the way OMP has none: give it
  no upstream host, set `alwaysCustom: true`, and give its one provider entry a
  bin and a setup file. The wizard then skips the provider question for it
  entirely and asks the two custom-base-url questions directly. See the OMP
  entry in `agents.ts` for the whole shape.
- **Add a wire format:** add a renderer in `render.ts` and name it on the
  catalogue entry. Unknown shapes already fall back to pretty-printed JSON, so
  you can iterate safely.
- **Watch the base URL suffix.** It is per-agent on purpose and never a global
  rule. Some agents append the whole path to what you give them and so must not
  have a `/v1`. Some append only the last part and so must have one. Getting it
  wrong produces a 404 that is hard to read. There is a test for each one.
- **Nothing to do for a student on an unlisted provider.** "Custom base URL" at
  the provider question already covers that — see the top of the
  [README](../README.md). It
  is not a per-agent thing to add; every supported agent gets it for free.
