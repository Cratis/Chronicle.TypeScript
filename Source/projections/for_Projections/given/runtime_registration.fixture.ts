// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, type Constructor } from '@cratis/fundamentals';
import { vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/IClientArtifactsProvider.js';
import type { ChronicleConnection } from '../../../connection/ChronicleConnection.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { Projections } from '../../Projections.js';
import type { IProjectionBuilderFor } from '../../declarative/IProjectionBuilderFor.js';
import { fromEvent } from '../../modelBound/fromEvent.js';
import { setFrom } from '../../modelBound/setFrom.js';

@eventType('runtime-added')
export class Added {
    @field(String) name = '';
}

export class RuntimeModel {
    static readonly readModelId = 'runtime-model';
    @field(String) name = '';
}

@fromEvent(Added)
export class BoundModel {
    @setFrom(Added)
    @field(String) name = '';
}

export function defineRuntime(builder: IProjectionBuilderFor<RuntimeModel>): void {
    builder.from(Added, from => from.set(model => model.name).to(event => event.name));
}

export function runtime_registration() {
    const artifacts: IClientArtifactsProvider & { projections: Constructor[]; readModels: Constructor[] } = {
        eventTypes: [Added], eventSourceTypes: [], projections: [], readModels: [], constraints: [], reactors: [], reducers: []
    };
    const registerProjection = vi.fn().mockResolvedValue({});
    const registerReadModel = vi.fn().mockResolvedValue({});
    const getState = vi.fn().mockResolvedValue({
        RunningState: 0, IsSubscribed: true, NextEventSequenceNumber: 0n, LastHandledEventSequenceNumber: 0n, TailEventSequenceNumber: 0n
    });
    const connection = {
        connectionId: 'connection',
        projections: { register: registerProjection },
        readModels: { registerMany: registerReadModel },
        observers: { getObserverInformation: getState }
    } as unknown as ChronicleConnection;
    const projections = new Projections('store', 'tenant', connection, artifacts, 'sink');
    return { artifacts, connection, projections, registerProjection, registerReadModel, getState };
}
