// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it, vi } from 'vitest';
import { CompatibilityResponse, type ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { CompatibilityPreflight } from '../../CompatibilityPreflight.js';

chai.should();

describe('when verifying with concurrent calls', () => {
    let check: ReturnType<typeof vi.fn>;
    let preflight: CompatibilityPreflight;
    let first: Promise<void>;
    let second: Promise<void>;
    let complete: (response: CompatibilityResponse) => void;

    beforeEach(() => {
        const response = new Promise<CompatibilityResponse>(resolve => { complete = resolve; });
        check = vi.fn(() => response);
        preflight = new CompatibilityPreflight({ checkCompatibility: check } as unknown as ConnectionServiceClient, 1000);
        first = preflight.verify();
        second = preflight.verify();
    });

    it('should share the same flight and issue exactly one RPC', async () => {
        first.should.equal(second);
        check.mock.calls.should.have.lengthOf(1);
        complete(CompatibilityResponse.create({ IsCompatible: true }));
        await Promise.all([first, second]);
    });

    it('should retain the successful verdict for later calls', async () => {
        complete(CompatibilityResponse.create({ IsCompatible: true }));
        await Promise.all([first, second]);
        await preflight.verify();
        check.mock.calls.should.have.lengthOf(1);
    });
});
