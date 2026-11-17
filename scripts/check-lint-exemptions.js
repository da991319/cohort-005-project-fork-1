// Lint exemptions say why, and there are never more of them than on the base.
//
//   node scripts/check-lint-exemptions.js [file...]
//     Every disable directive in these files (default: every tracked source
//     file) gives its reason after `--`.
//   node scripts/check-lint-exemptions.js --ratchet <ref>
//     The change adds no exemptions over its merge-base with <ref>. Skipped
//     when <ref> does not exist.
//
// An exemption is one rule named in a disable directive, or one file path
// listed in a .oxlintrc.json override. A directive that narrows a file-path
// override the base already had is not a new exemption.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SOURCE = /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts)$/;
const DIRECTIVE =
  /\/[/*]\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?(?=\s|\*\/|$)(.*)/;
const IGNORED = [/^drizzle\//, /^\.agents\//, /^\.claude\//];

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 });

const parseDirective = (line) => {
  const match = line.match(DIRECTIVE);
  if (!match) return undefined;
  const body = match[1].replace(/\*\/.*$/, "");
  const [rules, ...reason] = body.split(" -- ");
  return {
    rules: rules
      .split(",")
      .map((rule) => rule.trim())
      .filter(Boolean),
    reason: reason.join(" -- ").trim(),
  };
};

const isLinted = (file) =>
  SOURCE.test(file) && !IGNORED.some((pattern) => pattern.test(file));

const checkReasons = (files) => {
  const missing = [];
  for (const file of files.filter(isLinted)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const directive = parseDirective(line);
        if (directive && !directive.reason) {
          missing.push(`  ${file}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  if (missing.length === 0) return;
  console.error(`These lint exemptions do not say why:\n\n${missing.join("\n")}
\nAdd the reason after the rule names, separated by " -- ", as the other
directives in app/ do. Better still, change the code so it needs no exemption.`);
  process.exit(1);
};

// Exemptions in the working tree (ref undefined) or in a commit.
const readExemptions = (ref) => {
  const show = (path) =>
    ref ? git("show", `${ref}:${path}`) : readFileSync(path, "utf8");
  const config = JSON.parse(
    show(".oxlintrc.json").replace(/^\s*\/\/.*$/gm, "")
  );
  const overrides = (config.overrides ?? []).flatMap(({ files, rules }) =>
    files
      .filter((file) => !/[*?{[]/.test(file))
      .flatMap((file) => Object.keys(rules).map((rule) => `${file}|${rule}`))
  );

  const grepArgs = ["grep", "-n", "-E", "(oxlint|eslint)-disable"];
  let lines = "";
  try {
    lines = git(...grepArgs, ...(ref ? [ref] : []), "--", ".");
  } catch {
    // git grep exits 1 when nothing matches.
  }
  const directives = lines
    .split("\n")
    .map((line) => (ref ? line.slice(ref.length + 1) : line))
    .map((line) => line.match(/^([^:]+):\d+:(.*)$/))
    .filter((match) => match && isLinted(match[1]))
    .flatMap(([, file, text]) =>
      (parseDirective(text)?.rules ?? []).map((rule) => `${file}|${rule}`)
    );
  return { overrides, directives };
};

const ratchet = (ref) => {
  try {
    git("rev-parse", "--verify", "--quiet", `${ref}^{commit}`);
  } catch {
    console.log(`check-lint-exemptions: ${ref} not found, ratchet skipped.`);
    return;
  }
  const base = git("merge-base", "HEAD", ref).trim();
  const before = readExemptions(base);
  const after = readExemptions();
  const narrowed = new Set(before.overrides);
  const isNew = (key) => !narrowed.has(key);
  const count = ({ overrides, directives }, filter = () => true) =>
    overrides.length + directives.filter(filter).length;
  const beforeCount = count(before);
  const afterCount = count(after, isNew);
  if (afterCount <= beforeCount) return;
  console.error(`This change adds lint exemptions: ${beforeCount} on ${ref}, ${afterCount} now.

Make the code meet the rule instead. Exemptions only ever go down: a new
disable directive or a new file in a .oxlintrc.json override fails this check.
Moving code that already carries a directive keeps the count the same.`);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args[0] === "--ratchet") {
  ratchet(args[1] ?? "origin/main");
} else {
  const files =
    args.length > 0 ? args : git("ls-files").split("\n").filter(Boolean);
  checkReasons(
    files.map((file) =>
      file.replaceAll("\\", "/").replace(`${process.cwd()}/`, "")
    )
  );
}
