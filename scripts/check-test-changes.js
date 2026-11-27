#!/usr/bin/env node
// Fails when a branch takes anything away from a test file.
//
// Compares the branch with the base it will merge into (the merge base, as a
// pull request sees it: `git diff base...HEAD`) and looks only at test files.
// Adding is fine — a new test file, a new test, one more assertion. Deleting
// or rewriting a line is not: a test that changes along with the code it
// checks can no longer show that the code still does what it did. `--numstat`
// counts a changed line as one deletion and one addition, so any number in
// the "deleted" column means an existing line went. A rename on its own
// deletes nothing and passes.
//
// It does not decide whether such a change is wrong — a rename inside a test
// or a fixed typo is fine — it makes the change visible. CI runs it as a job
// of its own that is red on the pull request but not a required check, so a
// reviewer looks and a merge is still possible.
//
// Usage: pnpm test:changes [base]   (default: origin/main)
// Needs the base and the history down to the merge base; in CI that is
// `fetch-depth: 0` on checkout.
const { execFileSync } = require('child_process');

const base = process.argv[2] || process.env.BASE_REF || 'origin/main';

// What counts as a test file. Every kind the repo has: unit (*.spec.ts,
// *.test.tsx), against Postgres (*.db-spec.ts), over HTTP (*.int-spec.ts) and
// the Playwright suite with its helpers (apps/frontend/e2e/).
const TEST_FILES = [
  ':(glob)**/*.spec.ts',
  ':(glob)**/*.db-spec.ts',
  ':(glob)**/*.int-spec.ts',
  ':(glob)**/*.test.tsx',
  'apps/frontend/e2e/',
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

try {
  git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
} catch {
  console.error(
    `Base "${base}" is not a commit here. Fetch it first (in CI: actions/checkout with fetch-depth: 0).`,
  );
  process.exit(2);
}

// -z: paths verbatim, and a rename as two separate paths (old, new) instead
// of the "dir/{old => new}" a human reads.
const fields = git(
  'diff',
  '--numstat',
  '-z',
  '--find-renames',
  `${base}...HEAD`,
  '--',
  ...TEST_FILES,
).split('\0');

const changes = [];
for (let i = 0; i < fields.length && fields[i] !== ''; i += 1) {
  const [added, deleted, path] = fields[i].split('\t');
  // An empty path means a rename: the old and the new path follow.
  const file = path === '' ? fields[(i += 2)] : path;
  const from = path === '' ? fields[i - 1] : undefined;
  // Binary files show "-" in both columns; count them as rewritten.
  changes.push({
    added: added === '-' ? NaN : Number(added),
    deleted: deleted === '-' ? NaN : Number(deleted),
    file,
    from,
  });
}

const describe = ({ file, from }) => (from ? `${from} → ${file}` : file);

console.log(`Test files changed against ${base}: ${changes.length}`);
for (const change of changes) {
  console.log(`  +${change.added} -${change.deleted}  ${describe(change)}`);
}

const rewritten = changes.filter(({ deleted }) => deleted !== 0);
if (rewritten.length === 0) {
  console.log('\nOnly additions. OK.');
  process.exit(0);
}

console.error(
  `\n${rewritten.length} test file(s) lose or rewrite existing lines; review them before merging:`,
);
for (const change of rewritten) {
  const what = Number.isNaN(change.deleted)
    ? 'binary file changed'
    : `${change.deleted} line(s) deleted or rewritten`;
  console.error(`  ${describe(change)}  (${what})`);
  // An annotation on the pull request's "Files changed" tab.
  if (process.env.GITHUB_ACTIONS) {
    console.log(
      `::error file=${change.file},title=Test changed::${what} in a test file`,
    );
  }
}
process.exit(1);
