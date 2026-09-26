// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import type { EventStore } from '../../EventStore.js';
import { fromEvent } from '../../projections/modelBound/fromEvent.js';
import { setFrom } from '../../projections/modelBound/setFrom.js';
import { DecoratorType } from '../../types/DecoratorType.js';
import { TypeDiscoverer } from '../../types/TypeDiscoverer.js';

class Changed {}

function createClient() {
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
    const warn = vi.spyOn(client['_logger'], 'warn');
    const registerArtifacts = vi.fn().mockResolvedValue(undefined);
    const store = { name: { value: 'store' }, namespace: { value: 'Default' }, registerArtifacts } as unknown as EventStore;
    return { client, warn, store, registerArtifacts };
}

afterEach(() => {
    TypeDiscoverer.default.clear();
});

describe('when registering artifacts with standard property mappings', () => {
    it('should warn once about orphan mappings with their property and event type', async () => {
        class Orphan {
            @setFrom(Changed) value = '';
            @setFrom(Changed) name = '';
        }
        const { client, warn, store, registerArtifacts } = createClient();
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).toHaveBeenCalledTimes(1);
            expect(warn.mock.calls[0][0]).toContain('value <- Changed');
            expect(warn.mock.calls[0][0]).toContain('name <- Changed');
            expect(warn.mock.calls[0][0]).toContain('@fromEvent(...)');
            expect(warn.mock.calls[0][0]).toContain('discoveryPatterns');
            expect(warn.mock.calls[0][0]).toContain('register the class explicitly');
            expect(registerArtifacts).toHaveBeenCalledTimes(2);
            void Orphan;
        } finally {
            client.dispose();
        }
    });

    it('should not warn after the first instance registers the model before store creation', async () => {
        class Constructed { @setFrom(Changed) value = ''; }
        new Constructed();
        const { client, warn, store } = createClient();
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).not.toHaveBeenCalled();
        } finally {
            client.dispose();
        }
    });

    it('should not warn for a discovered export', async () => {
        class Discovered { @setFrom(Changed) value = ''; }
        const discoverer = new TypeDiscoverer(async () => ['model.ts'], async () => ({ Discovered }));
        await discoverer.discover('model.ts');
        const { client, warn, store } = createClient();
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).not.toHaveBeenCalled();
        } finally {
            client.dispose();
        }
    });

    it('should not warn for an explicitly registered class', async () => {
        class Explicit { @setFrom(Changed) value = ''; }
        TypeDiscoverer.default.register(DecoratorType.ReadModel, Explicit);
        const { client, warn, store } = createClient();
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).not.toHaveBeenCalled();
        } finally {
            client.dispose();
        }
    });

    it('should not warn for a class-level model mapping', async () => {
        @fromEvent(Changed)
        class ClassMapped { @setFrom(Changed) value = ''; }
        const { client, warn, store } = createClient();
        try {
            await client['registerArtifactsForStore'](store, 'new-store');
            expect(warn).not.toHaveBeenCalled();
            void ClassMapped;
        } finally {
            client.dispose();
        }
    });
});
