// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import type { ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { CompatibilityPreflight } from '../../CompatibilityPreflight.js';

chai.should();

describe('when verifying with the check skipped', () => {
    let check: ReturnType<typeof vi.fn>;
    let preflight: CompatibilityPreflight;

    beforeEach(() => {
        check = vi.fn();
        preflight = new CompatibilityPreflight({ checkCompatibility: check } as unknown as ConnectionServiceClient, 1000, true);
    });

    it('should resolve without asking the kernel', async () => {
        await preflight.verify();
        check.mock.calls.should.have.lengthOf(0);
    });
});
