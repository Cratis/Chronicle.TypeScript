// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { beginEventImport } from '../beginEventImport.js';
import type { IEventImport } from '../IEventImport.js';
import { ImportCouldNotBegin } from '../ImportCouldNotBegin.js';
import { OnInvalidEvent } from '../OnInvalidEvent.js';
import { a_kernel_import_session, numberedEvents } from '../for_EventImport/given/a_kernel_import_session.js';

chai.should();

describe('when reattaching to an import the kernel holds chunks for', () => {
    let kernel: a_kernel_import_session;
    let session: IEventImport;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.reads = [
            { EventSequenceId: 'event-log', OnInvalid: 1, MaxChunkEvents: 3, AcknowledgedChunks: 2, AcknowledgedEvents: 6n },
            { State: 4 }
        ];
        session = await beginEventImport({ imports: kernel.client, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' },
            kernel.importId.toString());
        await session.add(numberedEvents(10).slice(session.eventsAcknowledged));
        await session.complete();
    });

    it('should keep the identifier of the import', () => session.importId.toString().should.equal(kernel.importId.toString()));
    it('should say how many events the kernel already holds', () => session.eventsAcknowledged.should.equal(6));
    it('should continue numbering chunks after the acknowledged ones', () =>
        kernel.chunks.map(chunk => chunk.chunkIndex).sort().should.deep.equal([2, 3]));
    it('should continue numbering events after the acknowledged ones', () =>
        [...kernel.chunks].sort((left, right) => left.chunkIndex - right.chunkIndex).map(chunk => chunk.firstEventIndex)
            .should.deep.equal([6n, 9n]));
    it('should complete with every chunk and event of the import', () =>
        kernel.completions.should.deep.equal([{ ExpectedChunks: 4, ExpectedEvents: 10n }]));
});

describe('when reattaching to an import into another event sequence', () => {
    let error: unknown;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        kernel.reads = [{ EventSequenceId: 'outbox' }];
        error = await beginEventImport({ imports: kernel.client, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' },
            kernel.importId).catch(caught => caught);
    });

    it('should refuse to reattach', () => error.should.be.instanceOf(ImportCouldNotBegin));
});

describe('when reattaching to an import that does not exist', () => {
    let error: unknown;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        kernel.imports.getImport = async () => ({ IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], ExceptionStackTrace: '',
            CorrelationId: undefined, Data: undefined as never });
        error = await beginEventImport({ imports: kernel.client, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' },
            kernel.importId).catch(caught => caught);
    });

    it('should refuse to reattach', () => error.should.be.instanceOf(ImportCouldNotBegin));
});

describe('when beginning a new import', () => {
    let request: Record<string, unknown>;
    let session: IEventImport;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        const imports = { ...kernel.imports, beginImport: async (given: Record<string, unknown>) => {
            request = given;
            return { IsAuthorized: true, ValidationResults: [], ExceptionMessages: [], ExceptionStackTrace: '', AuthorizationFailureReason: '',
                CorrelationId: undefined, Response: { ImportId: given.ImportId, State: 0, MaxChunkEvents: 2, MaxChunkBytes: 0, Error: '' } };
        } };
        session = await beginEventImport({ imports: imports as never, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' },
            { onInvalid: OnInvalidEvent.Skip, importId: kernel.importId });
    });

    it('should begin it for the event sequence', () => request.EventSequenceId!.should.equal('event-log'));
    it('should pass what to do with invalid events', () => request.OnInvalid!.should.equal(1));
    it('should use the identifier the kernel gives back', () => session.importId.toString().length.should.equal(36));
    it('should start from the beginning', () => session.eventsAcknowledged.should.equal(0));
});
