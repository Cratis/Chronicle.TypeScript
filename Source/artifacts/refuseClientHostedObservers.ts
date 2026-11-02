// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IClientArtifactsProvider } from './IClientArtifactsProvider.js';
import { getReactorMetadata } from '../reactors/reactor.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { ClientObserversRequireKeepAlive } from '../connection/ClientObserversRequireKeepAlive.js';

/** Refuse client-hosted observers before any network or registration side effects. */
export function refuseClientHostedObservers(artifacts: Pick<IClientArtifactsProvider, 'reactors' | 'reducers'>): void {
    for (const type of artifacts.reactors) {
        const metadata = getReactorMetadata(type);
        if (metadata) throw new ClientObserversRequireKeepAlive('Reactor', metadata.id.value);
    }
    for (const type of artifacts.reducers) {
        const metadata = getReducerMetadata(type);
        if (metadata) throw new ClientObserversRequireKeepAlive('Reducer', metadata.id.value);
    }
}
