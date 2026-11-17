// Fails when a module in app/modules/ has no tests. A module is a deep module
// behind an entry point a test can call; a module with no test has no proof
// its interface works. See app/modules/README.md.
// Usage: node scripts/check-modules.js

import { readdirSync } from "node:fs";
import { join } from "node:path";

const MODULES = "app/modules";
const TEST = /\.test\.tsx?$/;

const hasTests = (dir) => {
  try {
    return readdirSync(dir, { recursive: true }).some((file) =>
      TEST.test(file)
    );
  } catch {
    return false;
  }
};

const untested = readdirSync(MODULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !hasTests(join(MODULES, name, "tests")));

if (untested.length > 0) {
  console.error(`These modules have no tests in their tests/ folder:\n`);
  for (const name of untested) console.error(`  ${MODULES}/${name}`);
  console.error(`
Add at least one <name>.test.ts under tests/ that calls the module through its
entry point. A module that reads the database takes the database as an
argument; its tests pass createTestDb() from ~/test/setup. See "Testing a
module that reads the database" in app/modules/README.md.`);
  process.exit(1);
}
