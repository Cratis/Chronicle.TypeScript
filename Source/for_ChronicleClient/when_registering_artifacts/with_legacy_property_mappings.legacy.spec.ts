// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { EventStore } from '../../EventStore.js';
import { setFrom } from '../../projections/modelBound/setFrom.js';

class Changed {}

class Legacy {
    @setFrom(Changed) value = '';
}

describe('when registering artifacts with legacy property mappings', () => {
    it('should not warn for the model registered on import', async () => {
        const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        const warn = vi.spyOn(client['_logger'], 'warn');
        const store = {
            name: { value: 'store' }, namespace: { value: 'Default' }, registerArtifacts: vi.fn().mockResolvedValue(undefined)
        } as unknown as EventStore;
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).not.toHaveBeenCalled();
            expect(Legacy).toBeDefined();
        } finally {
            client.dispose();
        }
    });
});
