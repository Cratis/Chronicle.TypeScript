#!/usr/bin/env node

if (process.argv.length < 3) {
    console.log('You have to specify a version');
    console.log('\nUsage: node publish-version.js <version>');
    process.exit(1);
}

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const version = process.argv[2];
const sourceDir = path.join(__dirname, 'Source');
const packageJsonPath = path.join(sourceDir, 'package.json');

// Read and update version in Source/package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (packageJson.private === true) {
    console.log(`Skipping private package '${packageJson.name}'`);
    process.exit(0);
}

packageJson.version = version;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
console.log(`Set version of '${packageJson.name}' to ${version}`);

// Copy README.md to Source if it doesn't exist there
const sourceReadme = path.join(sourceDir, 'README.md');
if (!fs.existsSync(sourceReadme)) {
    const rootReadme = path.join(__dirname, 'README.md');
    if (fs.existsSync(rootReadme)) {
        fs.copyFileSync(rootReadme, sourceReadme);
        console.log('Copied README.md to Source/');
    }
}

// Publish to npm
console.log(`Publishing '${packageJson.name}' at version ${version}`);
const result = spawnSync('npm', ['publish', '--provenance'], {
    cwd: sourceDir,
    stdio: 'inherit'
});

if (result.status !== 0) {
    console.error(`Failed to publish '${packageJson.name}'`);
    process.exit(result.status || 1);
}
