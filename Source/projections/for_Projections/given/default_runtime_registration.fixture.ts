// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { vi } from 'vitest';
import { DefaultClientArtifactsProvider } from '../../../artifacts/DefaultClientArtifactsProvider.js';
import { ChronicleClient } from '../../../ChronicleClient.js';
import { ChronicleOptions } from '../../../ChronicleOptions.js';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { EventStore } from '../../../EventStore.js';
import { EventStoreName } from '../../../EventStoreName.js';
import { EventStoreNamespaceName } from '../../../EventStoreNamespaceName.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../declarative/IProjectionBuilderFor.js';
import { setFrom } from '../../modelBound/setFrom.js';

/** Fresh, unconstructed standard-decorated models and a real provider on a cached event store. */
export function default_runtime_registration() {
    @eventType('default-runtime-added')
    class Added {
        @field(String) name = '';
    }

    class PropertyModel {
        static readonly readModelId = 'property-runtime';
        @setFrom(Added)
        @field(String) name = '';
    }

    const artifacts = DefaultClientArtifactsProvider.default;
    const registerProjection = vi.fn().mockResolvedValue({});
    const register = vi.fn().mockResolvedValue({});
    const connection = new Proxy({}, {
        get: (_target, service) => {
            if (service === 'logger') return undefined;
            if (service === 'projections') return { register: registerProjection };
            return new Proxy({}, { get: () => register });
        }
    }) as ChronicleConnection;
    const client = new ChronicleClient(ChronicleOptions.fromConnectionString('chronicle://localhost:35000', { discoveryPatterns: [] }));
    const store = new EventStore(new EventStoreName('store'), EventStoreNamespaceName.default, connection, client['_lifecycle'], 'sink', artifacts);
    client['_stores'].set('store', store);

    const define = (builder: IProjectionBuilderFor<PropertyModel>): void => {
        builder.from(Added, from => from.set(model => model.name).to(event => event.name));
    };
    const reconnect = (): Promise<void> => client['_lifecycle'].connected(error => { throw error; });
    const dispose = (): void => {
        store.disposeObservations();
        client.dispose();
    };
    return { artifacts, Added, PropertyModel, store, registerProjection, define, reconnect, dispose };
}
