// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { CompatibilityResponse, type ConnectionServiceClient } from '@cratis/chronicle.contracts';
import { CompatibilityPreflight } from '../../CompatibilityPreflight.js';
import { IncompatibleChronicleServer } from '../../IncompatibleChronicleServer.js';

function verifyVersion(serverVersion: string): Promise<void> {
    const checkCompatibility = vi.fn(async () => CompatibilityResponse.create({ IsCompatible: true, ServerVersion: serverVersion }));
    return new CompatibilityPreflight({ checkCompatibility } as unknown as ConnectionServiceClient, 100).verify();
}

describe('when verifying the kernel version despite a compatible contract', () => {
    it('should reject the release immediately before the registered event source fix', async () => {
        await expect(verifyVersion('19.37.3')).rejects.toThrow(IncompatibleChronicleServer);
    });
    it('should reject an older minor release even with a higher patch', async () => {
        await expect(verifyVersion('19.36.99')).rejects.toThrow(IncompatibleChronicleServer);
    });
    it('should reject an older major release even with higher minor and patch versions', async () => {
        await expect(verifyVersion('18.99.99')).rejects.toThrow(IncompatibleChronicleServer);
    });
    it('should reject a missing version instead of assuming the batch behavior is safe', async () => {
        await expect(verifyVersion('')).rejects.toThrow(IncompatibleChronicleServer);
    });
    it('should reject an unrecognized version', async () => {
        await expect(verifyVersion('unknown')).rejects.toThrow(IncompatibleChronicleServer);
    });
    it('should accept the first release that preserves registered event sources', async () => {
        await expect(verifyVersion('19.37.4')).resolves.toBeUndefined();
    });
    it('should compare patch versions numerically', async () => {
        await expect(verifyVersion('19.37.10')).resolves.toBeUndefined();
    });
    it('should accept a newer minor release with a lower patch', async () => {
        await expect(verifyVersion('19.38.0')).resolves.toBeUndefined();
    });
    it('should accept a newer major release with lower minor and patch versions', async () => {
        await expect(verifyVersion('20.0.0')).resolves.toBeUndefined();
    });
    it('should accept the development image of the fixed release', async () => {
        await expect(verifyVersion('19.37.4-development')).resolves.toBeUndefined();
    });
    it('should reject a development image older than the fixed release', async () => {
        await expect(verifyVersion('19.37.3-development')).rejects.toThrow(IncompatibleChronicleServer);
    });
});
