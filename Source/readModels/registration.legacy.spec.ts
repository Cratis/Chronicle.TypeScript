// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { describe, expect, it, vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../artifacts/DefaultClientArtifactsProvider.js';
import type { ChronicleConnection } from '../connection/ChronicleConnection.js';
import { eventType } from '../events/eventTypeDecorator.js';
import { setFrom } from '../projections/modelBound/setFrom.js';
import { Projections } from '../projections/Projections.js';

@eventType('legacy-cold-registration-event')
class Changed { @field(String) value!: string; }

let constructions = 0;
class LegacyPropertyOnly {
    @setFrom(Changed)
    @field(String)
    value = '';

    constructor() { constructions++; }
}

describe('when registering a legacy-decorated property-only read model', () => {
    it('should discover and register it without constructing an instance first', async () => {
        expect(constructions).toBe(0);
        const provider = DefaultClientArtifactsProvider.default;
        expect(provider.readModels).toContain(LegacyPropertyOnly);
        const registerMany = vi.fn().mockResolvedValue({});
        const register = vi.fn().mockResolvedValue({});
        const connection = { readModels: { registerMany }, projections: { register } } as unknown as ChronicleConnection;

        await new Projections('store', 'Default', connection, provider, 'sink').register();

        expect(registerMany.mock.calls[0][0].ReadModels.some((model: { Type: { Identifier: string } }) => model.Type.Identifier === 'LegacyPropertyOnly')).toBe(true);
        expect(register.mock.calls.some(call => call[0].Projections[0].ReadModel === 'LegacyPropertyOnly')).toBe(true);
    });
});
