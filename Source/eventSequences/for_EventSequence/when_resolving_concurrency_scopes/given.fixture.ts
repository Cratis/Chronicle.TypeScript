// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { vi } from 'vitest';
import type { ChronicleConnection } from '../../../connection/index.js';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import { ConcurrencyDimensions, eventSource, eventStream, EventSources } from '../../../eventSources/index.js';
import { eventType } from '../../../events/index.js';
import type { IUnitOfWorkManager } from '../../../transactions/index.js';
import { EventSequence, EventSequenceId, type ConcurrencyScopeStrategy } from '../../index.js';

export class Deposited { constructor(readonly amount = 1) {} }
eventType('ConcurrencyStrategyDeposited')(Deposited);

@eventSource({ name: 'Account' })
@eventStream('Transactions', { concurrency: ConcurrencyDimensions.eventSourceId | ConcurrencyDimensions.eventStreamType | ConcurrencyDimensions.eventStreamId })
class AccountEventSource {}

export const routing = { eventSource: AccountEventSource, eventStream: 'Transactions', streamId: 'tx-1' };

export async function create(strategy?: ConcurrencyScopeStrategy, tail = 7n) {
    const append = vi.fn(async (_request: Parameters<ChronicleConnection['eventSequences']['append']>[0]) => ({ Response: { SequenceNumber: 0n } }));
    const appendManyForEventSources = vi.fn(async (_request: Parameters<ChronicleConnection['eventSequences']['appendManyForEventSources']>[0]) => ({ Response: { SequenceNumbers: [0n, 1n] } }));
    const tailSequenceNumber = vi.fn(async (_request: Parameters<ChronicleConnection['eventSequences']['tailSequenceNumber']>[0]) => ({ Data: { SequenceNumber: tail } }));
    const connection = { eventSequences: { append, appendManyForEventSources, tailSequenceNumber } } as unknown as ChronicleConnection;
    const sources = new EventSources('store', connection, { eventSources: [AccountEventSource] } as unknown as IClientArtifactsProvider);
    await sources.discover();
    const sequence = new EventSequence(EventSequenceId.eventLog, 'store', 'ns', connection, {} as IUnitOfWorkManager,
        undefined, undefined, sources, [], strategy);
    return { sequence, append, appendManyForEventSources, tailSequenceNumber };
}
