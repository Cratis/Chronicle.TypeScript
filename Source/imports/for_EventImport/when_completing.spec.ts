// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ImportState as ContractsImportState } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import type { ImportResult } from '../ImportResult.js';
import { ImportState } from '../ImportState.js';
import { a_kernel_import_session, numberedEvents } from './given/a_kernel_import_session.js';

chai.should();

describe('when completing an import that commits', () => {
    let kernel: a_kernel_import_session;
    let result: ImportResult;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.reads = [
            { State: ContractsImportState.Validating },
            { State: ContractsImportState.Committing, EventsStaged: 3n, EventsCommitted: 1n },
            { State: ContractsImportState.Completed, EventsStaged: 3n, EventsCommitted: 3n, FirstSequenceNumber: 10n, LastSequenceNumber: 12n }
        ];
        const session = kernel.session();
        await session.add(numberedEvents(3));
        result = await session.complete();
    });

    it('should wait until the commit is done', () => kernel.readCount.should.equal(3));
    it('should be a success', () => result.isSuccess.should.be.true);
    it('should report the events committed', () => result.eventsCommitted.should.equal(3));
    it('should report the first sequence number', () => result.firstSequenceNumber!.value.should.equal(10n));
    it('should report the last sequence number', () => result.lastSequenceNumber!.value.should.equal(12n));
    it('should carry the identifier of the import', () => result.importId.toString().should.equal(kernel.importId.toString()));
});

describe('when completing an import with invalid events', () => {
    let result: ImportResult;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        kernel.reads = [{
            State: ContractsImportState.Failed, EventsStaged: 2n, RejectedCount: 1n, FailureReason: 'One event was rejected',
            Rejections: [{ Index: 1n, EventType: 'numbered', Reasons: ['number must be positive'] }]
        }];
        const session = kernel.session();
        await session.add(numberedEvents(2));
        result = await session.complete();
    });

    it('should not be a success', () => result.isSuccess.should.be.false);
    it('should be failed', () => result.state.should.equal(ImportState.Failed));
    it('should commit nothing', () => result.eventsCommitted.should.equal(0));
    it('should report no sequence numbers', () => (result.firstSequenceNumber === undefined).should.be.true);
    it('should report the rejected event by its index', () =>
        result.rejections.should.deep.equal([{ index: 1, eventType: 'numbered', reasons: ['number must be positive'] }]));
    it('should report how many were rejected', () => result.rejectedCount.should.equal(1));
    it('should report why it failed', () => result.failureReason!.should.equal('One event was rejected'));
});

describe('when completing an import without waiting for the commit', () => {
    let kernel: a_kernel_import_session;
    let result: ImportResult;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.reads = [{ State: ContractsImportState.Committing }, { State: ContractsImportState.Completed }];
        const session = kernel.session({ options: { waitForCommit: false } });
        await session.add(numberedEvents(1));
        result = await session.complete();
    });

    it('should read the import once', () => kernel.readCount.should.equal(1));
    it('should report the state it read', () => result.state.should.equal(ImportState.Committing));
});
