// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import { ObserverInformation, PartitionRecoveryOutcome } from '@cratis/chronicle.contracts';
import type { ChronicleConnection } from '../../../connection/index.js';
import { ObserverOperations } from '../../ObserverOperations.js';

/** An observer operations instance over a mocked connection. */
export class observer_operations {
    readonly information = vi.fn(async (_request: object) => ObserverInformation.fromPartial({}));
    readonly replay = vi.fn(async (_request: object) => ({ JobId: '' }));
    readonly retryPartition = vi.fn(async (_request: object) => ({ Outcome: PartitionRecoveryOutcome.Started }));
    readonly failedPartitions = vi.fn(async (_request: object) => ({ items: [] as object[] }));
    readonly operations = new ObserverOperations('store', 'tenant', {
        observers: { getObserverInformation: this.information, replay: this.replay, retryPartition: this.retryPartition },
        failedPartitions: { getFailedPartitions: this.failedPartitions }
    } as unknown as ChronicleConnection);
}
