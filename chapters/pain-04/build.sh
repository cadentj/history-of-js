#!/usr/bin/env bash
# Bundle: src/*.js → bundle.js. Run from this directory.
set -euo pipefail
cd "$(dirname "$0")"
node bundler.js src/main.js > bundle.js
echo "wrote bundle.js"
