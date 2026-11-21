// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, it, beforeEach, vi } from 'vitest';
import { should } from 'chai';
import { CompatibilityPreflight } from '../../CompatibilityPreflight.js';

should();

for (const version of ['19.37.4', '19.37.4-development', '19.38.0', '20.0.0', '19.37.3', '19.36.99', '1.0.0', 'unknown', '']) {
    describe(`when verifying a compatible contract on kernel ${version || 'without a version'}`, () => {
        let check: ReturnType<typeof vi.fn>;
        let preflight: CompatibilityPreflight;

        beforeEach(async () => {
            check = vi.fn().mockResolvedValue({ IsCompatible: true, Incompatibilities: [], ServerVersion: version });
            preflight = new CompatibilityPreflight({ checkCompatibility: check } as never, 1000, false);
            await preflight.verify();
        });

        it('should check compatibility once', () => check.mock.calls.should.have.lengthOf(1));
        it('should retain the reported version without refusing the connection', () => preflight.kernelVersion!.should.equal(version));
    });
}

describe('when skipping the contract check', () => {
    let check: ReturnType<typeof vi.fn>;
    let preflight: CompatibilityPreflight;

    beforeEach(async () => {
        check = vi.fn();
        preflight = new CompatibilityPreflight({ checkCompatibility: check } as never, 1000, true);
        await preflight.verify();
    });

    it('should not request a server version', () => check.mock.calls.should.have.lengthOf(0));
    it('should leave the kernel version unknown', () => (preflight.kernelVersion === undefined).should.equal(true));
});
