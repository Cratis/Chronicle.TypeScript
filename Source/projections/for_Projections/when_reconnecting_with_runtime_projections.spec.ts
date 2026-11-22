// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { afterEach, describe, expect, it } from 'vitest';
import { ChronicleClient } from '../../ChronicleClient.js';
import { ChronicleOptions } from '../../ChronicleOptions.js';
import { an_event_store } from '../../for_EventStore/when_inspecting_registration/given/an_event_store.js';
import { BoundModel, defineRuntime, RuntimeModel } from './given/runtime_registration.fixture.js';

let client: ChronicleClient | undefined;
let context: ReturnType<typeof an_event_store> | undefined;
afterEach(() => {
    context?.store.disposeObservations();
    client?.dispose();
});

describe('when a cached store reconnects with runtime projections', () => {
    it('should rediscover artifacts and re-register both retained authoring forms', async () => {
        context = an_event_store();
        client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
        client['_stores'].set('store', context.store);
        await context.store.projections.registerFor(RuntimeModel, defineRuntime);
        await context.store.projections.registerModelBound(BoundModel);
        const explicitRequests = context.registerProjection.mock.calls.map(call => call[0]);
        context.registerProjection.mockClear();

        // This is the callback used after the connection is re-established; it registers cached stores.
        await client['_lifecycle'].connected(error => { throw error; });

        expect(context.registerProjection).toHaveBeenCalledTimes(5);
        for (const request of explicitRequests) expect(context.registerProjection).toHaveBeenCalledWith(request);
        expect(context.store.projections.getProjectionIdFor(RuntimeModel).value).toBe('runtime-model');
        expect(context.store.projections.getProjectionIdFor(BoundModel).value).toBe('BoundModel');
        expect(context.store.registrationResult.state).toBe('successful');
    });
});
