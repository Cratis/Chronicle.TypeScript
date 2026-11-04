// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IClientArtifactsProvider } from './IClientArtifactsProvider.js';
import { getReactorMetadata } from '../reactors/reactor.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { ClientObserversRequireKeepAlive } from '../connection/ClientObserversRequireKeepAlive.js';

/** Refuse client-hosted observers before any network or registration side effects. */
export function refuseClientHostedObservers(artifacts: Pick<IClientArtifactsProvider, 'reactors' | 'reducers'>): void {
    const reactor = artifacts.reactors.map(getReactorMetadata).find(metadata => metadata !== undefined);
    if (reactor) throw new ClientObserversRequireKeepAlive('Reactor', reactor.id.value);

    const reducer = artifacts.reducers.map(getReducerMetadata).find(metadata => metadata !== undefined);
    if (reducer) throw new ClientObserversRequireKeepAlive('Reducer', reducer.id.value);
}
