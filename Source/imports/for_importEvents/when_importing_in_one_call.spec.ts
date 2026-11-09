// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ImportState as ContractsImportState } from '@cratis/chronicle.contracts';
import { field } from '@cratis/fundamentals';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../events/eventTypeDecorator.js';
import type { EventForEventSourceId } from '../../eventSequences/EventForEventSourceId.js';
import { importEvents } from '../importEvents.js';
import type { ImportProgress } from '../ImportProgress.js';
import type { ImportResult } from '../ImportResult.js';
import { ImportState } from '../ImportState.js';
import type { ImportTarget } from '../ImportTarget.js';
import { a_kernel_import_session } from '../for_EventImport/given/a_kernel_import_session.js';

chai.should();

@eventType('import-spec-item-counted')
class ItemCounted {
    @field(Number) number: number;
    constructor(number = 0) { this.number = number; }
}

const numbered = (number: number): EventForEventSourceId => ({ eventSourceId: 'source', event: new ItemCounted(number) });
const range = (count: number) => Array.from({ length: count }, (_, index) => index);
const numbersReceivedBy = (kernel: a_kernel_import_session) => kernel.receivedContents.map(content => (JSON.parse(content) as ItemCounted).number);

function targetFor(kernel: a_kernel_import_session): ImportTarget {
    return { imports: kernel.client, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' };
}

describe('when importing events from an async iterable in one call', () => {
    let kernel: a_kernel_import_session;
    let result: ImportResult;
    let progress: ImportProgress[];
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.limits = { MaxChunkEvents: 5, MaxChunkBytes: 0 };
        kernel.observed = [
            { State: ContractsImportState.Staging, EventsReceived: 5n, EventsStaged: 5n },
            { State: ContractsImportState.Committing, EventsReceived: 12n, EventsStaged: 12n, EventsCommitted: 4n, RejectedCount: 0n }
        ];
        kernel.reads = [{ State: ContractsImportState.Completed, EventsStaged: 12n, EventsCommitted: 12n, FirstSequenceNumber: 0n, LastSequenceNumber: 11n }];
        progress = [];
        async function* source(): AsyncGenerator<EventForEventSourceId> {
            for (let index = 0; index < 12; index++) yield numbered(index);
        }
        result = await importEvents(targetFor(kernel), source(), { onProgress: report => progress.push(report) });
    });

    it('should send every event once, in order', () => numbersReceivedBy(kernel).should.deep.equal(range(12)));
    it('should cut chunks within the kernel limit', () => kernel.chunks.length.should.equal(3));
    it('should complete the import', () => kernel.completions.should.deep.equal([{ ExpectedChunks: 3, ExpectedEvents: 12n }]));
    it('should report the result', () => result.isSuccess.should.be.true);
    it('should report the committed range', () => result.lastSequenceNumber!.value.should.equal(11n));
    it('should report progress as the kernel reports it', () => progress.map(report => report.state)
        .should.deep.equal([ImportState.Staging, ImportState.Committing]));
    it('should report the counts of the progress', () => progress[1].eventsCommitted.should.equal(4));
});

describe('when importing events from an iterable in one call', () => {
    let kernel: a_kernel_import_session;
    let result: ImportResult;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        function* source(): Generator<EventForEventSourceId> {
            for (let index = 0; index < 3; index++) yield numbered(index);
        }
        result = await importEvents(targetFor(kernel), source());
    });

    it('should send every event', () => numbersReceivedBy(kernel).should.deep.equal(range(3)));
    it('should report the result', () => result.isSuccess.should.be.true);
});

describe('when cancelling an import in one call with an abort signal', () => {
    let kernel: a_kernel_import_session;
    let error: unknown;
    let reason: Error;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.limits = { MaxChunkEvents: 1, MaxChunkBytes: 0 };
        const controller = new AbortController();
        reason = new Error('cancelled by the caller');
        async function* source(): AsyncGenerator<EventForEventSourceId> {
            yield numbered(0);
            yield numbered(1);
            controller.abort(reason);
            yield numbered(2);
            yield numbered(3);
        }
        error = await importEvents(targetFor(kernel), source(), { signal: controller.signal }).catch(caught => caught);
    });

    it('should stop with the reason it was cancelled for', () => error!.should.equal(reason));
    it('should not complete the import', () => kernel.completions.should.be.empty);
    it('should stop reading the source', () => kernel.receivedContents.length.should.be.at.most(2));
    it('should leave the import open on the kernel to be reattached', () => kernel.abandons.should.be.empty);
});
