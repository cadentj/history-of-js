#!/usr/bin/env node
/* eslint-disable no-console */
var fs = require('fs');
var path = require('path');

var root = process.cwd();
var painDirPattern = /^pain-\d{2}-.+/;
var BEGIN_BLOCK = /\/\*\s*BEGIN_PROBLEM_EXCLUDE\s*\*\/[\s\S]*?\/\*\s*END_PROBLEM_EXCLUDE\s*\*\//g;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function stripTaggedBlocks(content) {
  return content
    .replace(BEGIN_BLOCK, '/* TODO: implement this section */')
    .replace(/\/\/\s*BEGIN_PROBLEM_EXCLUDE[\s\S]*?\/\/\s*END_PROBLEM_EXCLUDE/g, '// TODO: implement this section');
}

function copySolutionToProblem(solutionRoot, problemRoot) {
  ensureDir(problemRoot);
  var entries = fs.readdirSync(solutionRoot, { withFileTypes: true });

  entries.forEach(function (entry) {
    var sourcePath = path.join(solutionRoot, entry.name);
    var targetPath = path.join(problemRoot, entry.name);

    if (entry.isDirectory()) {
      copySolutionToProblem(sourcePath, targetPath);
      return;
    }

    var original = fs.readFileSync(sourcePath, 'utf8');
    var transformed = stripTaggedBlocks(original);
    fs.writeFileSync(targetPath, transformed, 'utf8');
  });
}

function main() {
  var repoEntries = fs.readdirSync(root, { withFileTypes: true });
  var painDirs = repoEntries
    .filter(function (entry) { return entry.isDirectory() && painDirPattern.test(entry.name); })
    .map(function (entry) { return entry.name; })
    .sort();

  if (painDirs.length === 0) {
    console.log('No pain-* directories found.');
    return;
  }

  painDirs.forEach(function (painDir) {
    var solutionRoot = path.join(root, painDir, 'solution');
    var problemRoot = path.join(root, painDir, 'problem');

    if (!fs.existsSync(solutionRoot)) {
      console.log('Skipping ' + painDir + ' (no solution/ directory).');
      return;
    }

    copySolutionToProblem(solutionRoot, problemRoot);
    console.log('Generated ' + path.relative(root, problemRoot));
  });
}

main();
