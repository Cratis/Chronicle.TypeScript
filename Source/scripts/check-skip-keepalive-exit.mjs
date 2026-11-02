// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const probe = fileURLToPath(new URL('../dist/for_ChronicleClient/when_skipping_keep_alive/native-exit-probe.js', import.meta.url));
if (!process.env.CHRONICLE_INTEGRATION_CONNECTION_STRING) {
    throw new Error('Runtime proof requires CHRONICLE_INTEGRATION_CONNECTION_STRING and a compatible live Chronicle kernel');
}
if (!existsSync(probe)) throw new Error('Run yarn build before the native exit probe');

function parseMarker(line) {
    try { return JSON.parse(line); } catch { return {}; }
}

function isExpectedExit(mode, code, signal, expectedKill) {
    if (mode === 'default') return expectedKill && signal === 'SIGKILL';
    return code === 0 && signal === null;
}

export async function checkExit(mode) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [probe, mode], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let markerSeen = false;
        let expectedKill = false;
        let markerTimer;
        const deadline = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`${mode}: timed out without natural exit; marker=${markerSeen}\n${stdout}\n${stderr}`));
        }, 20_000);
        child.stdout.on('data', data => {
            stdout += data;
            const lines = stdout.split('\n').filter(Boolean);
            for (const line of lines) {
                const marker = parseMarker(line);
                if (marker.mode !== mode || !['operations-completed', 'observer-refused'].includes(marker.marker)) continue;
                if (markerSeen) continue;
                markerSeen = true;
                if (mode === 'default') {
                    markerTimer = setTimeout(() => { expectedKill = true; child.kill('SIGKILL'); }, 1500);
                }
            }
        });
        child.stderr.on('data', data => { stderr += data; });
        child.once('error', error => { clearTimeout(deadline); clearTimeout(markerTimer); reject(error); });
        child.once('exit', (code, signal) => {
            clearTimeout(deadline);
            clearTimeout(markerTimer);
            if (!markerSeen || !isExpectedExit(mode, code, signal, expectedKill)) {
                reject(new Error(`${mode}: unexpected exit code=${code} signal=${signal} marker=${markerSeen}\n${stdout}\n${stderr}`));
            } else resolve({ mode, code, signal, markerSeen, stdout });
        });
    });
}
for (const mode of ['skip', 'default', 'reactor', 'reducer']) {
    console.log(JSON.stringify(await checkExit(mode)));
}
