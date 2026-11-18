// Fails when a file is too big for an agent to read and edit in one go.
// Tokens are estimated as bytes / 4, which is close enough for code.
// Usage: node scripts/check-file-tokens.js <file>...

import { readFileSync, statSync } from "node:fs";

const MAX_TOKENS = 5000;
const BYTES_PER_TOKEN = 4;

// Generated files that nobody edits by hand, and workflow files, which
// GitHub reads as one file each and which cannot be split.
const IGNORED = [
  /(^|\/)package-lock\.json$/,
  /^drizzle\//,
  /^\.github\/workflows\/[^/]+\.yml$/,
];

// Files already over the limit. Each has its own issue to split it, as a pull
// request that only moves code. A ticket that touches one of these leaves it
// at its size. Remove each entry in the commit that splits the file.
const BASELINE = [
  "app/lib/refunds.server.test.ts",
  "app/modules/instructor-analytics/lib/instructor-analytics.ts",
  "app/modules/instructor-analytics/tests/instructor-analytics.test.ts",
  "app/routes/courses.$slug.tsx",
  "app/routes/instructor.$courseId.lessons.$lessonId.quiz.tsx",
  "app/routes/instructor.$courseId.tsx",
  "app/routes/instructor.analytics.tsx",
  "request-logger/README.md",
  "request-logger/agents.test.ts",
  "request-logger/agents.ts",
  "request-logger/proxy.ts",
  "request-logger/render.ts",
  "scripts/seed.ts",
];

const isBinary = (contents) => contents.subarray(0, 8000).includes(0);
const isFile = (file) => statSync(file, { throwIfNoEntry: false })?.isFile();
const tokensOf = (contents) => Math.ceil(contents.length / BYTES_PER_TOKEN);

const stale = BASELINE.filter(
  (file) => !isFile(file) || tokensOf(readFileSync(file)) <= MAX_TOKENS
);
if (stale.length > 0) {
  console.error(`These baseline entries in scripts/check-file-tokens.js are gone or
now under ${MAX_TOKENS} tokens. Remove them from BASELINE:\n`);
  for (const file of stale) console.error(`  ${file}`);
  process.exit(1);
}

const oversized = process.argv
  .slice(2)
  .map((file) => file.replaceAll("\\", "/").replace(`${process.cwd()}/`, ""))
  .filter((file) => !IGNORED.some((pattern) => pattern.test(file)))
  .filter((file) => !BASELINE.includes(file))
  .filter(isFile)
  .map((file) => ({ file, contents: readFileSync(file) }))
  .filter(({ contents }) => !isBinary(contents))
  .map(({ file, contents }) => ({ file, tokens: tokensOf(contents) }))
  .filter(({ tokens }) => tokens > MAX_TOKENS);

if (oversized.length > 0) {
  console.error(`These files are over ${MAX_TOKENS} tokens (bytes / 4):\n`);
  for (const { file, tokens } of oversized) {
    console.error(`  ${file}: ~${tokens} tokens`);
  }
  console.error(`
Split each file before you commit. Do not delete code or squash it onto fewer
lines to get under the limit.

How to split:
- Find the seams. Look for groups of functions, components, or tests that
  change together and share little with the rest of the file.
- Route modules (app/routes/*): keep the loader, action, and page component in
  the route file. Move the business logic into a module in app/modules/ and
  sub-components into their own files in app/components/.
- Logic that is already in a module (app/modules/<name>/): split it into more
  files under lib/. Keep the entry points (index.ts, index.server.ts) small. Do
  not add a barrel file. See app/modules/README.md.
- Tests: split by the behaviour under test, one file per area (for example
  <name>.refunds.test.ts, <name>.permissions.test.ts). Move shared fixtures
  into a fixtures file in the same tests/ folder.
- Scripts and seed data: move large data literals into their own files and
  import them.

When you are done, run \`npm run check\` and commit again.`);
  process.exit(1);
}
