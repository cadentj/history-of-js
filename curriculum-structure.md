# Curriculum scaffold (pains 1-6)

This repository now includes starter scaffolding for pain points 1 through 6.

## Layout

Each pain point has:
- `solution/`: instructor-complete reference files.
- `problem/`: auto-generated learner files with tagged sections removed.

Directories:
- `pain-01-async/`
- `pain-02-script-scope/`
- `pain-03-package-manager/`
- `pain-04-commonjs/`
- `pain-05-bundler/`
- `pain-06-transpile/`

## Problem generation

Run:

```bash
node scripts/create-problems.js
```

The generator copies every file from each `solution/` folder into `problem/`, replacing code between:

- `/* BEGIN_PROBLEM_EXCLUDE */ ... /* END_PROBLEM_EXCLUDE */`
- `// BEGIN_PROBLEM_EXCLUDE ... // END_PROBLEM_EXCLUDE`

with TODO placeholders.
