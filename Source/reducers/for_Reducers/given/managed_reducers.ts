// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { Constructor } from '@cratis/fundamentals';
import { ObserverInformation, PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ConnectionLifecycle } from '../../../connection/ConnectionLifecycle.js';
import { reducer } from '../../reducer.js';
import { Reducers } from '../../Reducers.js';

@reducer('on-custom', 'custom')
export class OnCustomSequence {}

@reducer('on-log')
export class OnEventLog {}

export class NotAReducer {}

export const request = (observerId: string, eventSequenceId: string) =>
    ({ EventStore: 'store', Namespace: 'tenant', ObserverId: observerId, EventSequenceId: eventSequenceId });

/** Reducers over a mocked connection, for the management operations only. */
export class managed_reducers {
    readonly artifacts: Constructor[] = [];
    readonly information = vi.fn(async (_request: object) => ObserverInformation.fromPartial({ Id: 'on-custom', IsSubscribed: true }));
    readonly replay = vi.fn(async (_request: object) => ({ JobId: '' }));
    readonly retryPartition = vi.fn(async (_request: object) => ({ Outcome: PartitionRecoveryOutcome.Started }));
    readonly failedPartitions = vi.fn(async (_request: object) => ({ items: [] as object[] }));
    readonly reducers: Reducers;

    constructor() {
        this.reducers = new Reducers({ reducers: this.artifacts, eventTypes: [], readModels: [] } as unknown as IClientArtifactsProvider, {
            observers: { getObserverInformation: this.information, replay: this.replay, retryPartition: this.retryPartition },
            failedPartitions: { getFailedPartitions: this.failedPartitions }
        } as unknown as ChronicleConnection, 'store', 'tenant', new ConnectionLifecycle(), 'sink');
    }
}
