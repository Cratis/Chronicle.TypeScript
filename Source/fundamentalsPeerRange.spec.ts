// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The peer range's lower bound is a compatibility claim; the exact devDependency pin is the only version this
// package is ever compiled and tested against. When they disagree the range claims support for versions nothing
// verifies, and nothing fails until a consumer resolves one of them.
//
// That is not hypothetical: the range shipped as ^7 while ConceptAs - used here as a runtime value, compared by
// class object in JsonSchemaGenerator - only exists from 7.14.0 onward, leaving 48 published versions that
// satisfied the range and could not link. Tying the bound to the pin is what stops the two drifting again.
const manifest = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf-8')) as {
        peerDependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };

describe('fundamentals peer range', () => {
    const peer = manifest.peerDependencies?.['@cratis/fundamentals'];
    const pinned = manifest.devDependencies?.['@cratis/fundamentals'];

    it('should declare fundamentals as a peer dependency', () => expect(peer).toBeDefined());

    it('should pin one concrete version to build against', () => expect(pinned).toMatch(/^\d+\.\d+\.\d+$/));

    it('should admit no version below the one it builds against', () => expect(peer).toBe(`^${pinned}`));
});
