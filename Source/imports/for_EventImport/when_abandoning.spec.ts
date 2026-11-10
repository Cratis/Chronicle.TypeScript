// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { EventForEventSourceId } from '../../eventSequences/EventForEventSourceId.js';
import type { ImportResult } from '../ImportResult.js';
import { ImportState } from '../ImportState.js';
import { ImportWasAbandoned } from '../ImportWasAbandoned.js';
import { a_kernel_import_session, numbered, numberedEvents } from './given/a_kernel_import_session.js';

chai.should();

describe('when abandoning an import while events are being added from a source that stalls', () => {
    let kernel: a_kernel_import_session;
    let addError: unknown;
    let completeError: unknown;
    let result: ImportResult;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        async function* stalling(): AsyncGenerator<EventForEventSourceId> {
            yield numbered(0);
            yield numbered(1);
            await new Promise(() => undefined);
        }
        const session = kernel.session({ maxChunkEvents: 1 });
        const adding = session.add(stalling()).catch(caught => caught);
        await new Promise(resolve => setTimeout(resolve, 10));
        result = await session.abandon();
        addError = await adding;
        completeError = await session.complete().catch(caught => caught);
    });

    it('should stop the add', () => addError.should.be.instanceOf(ImportWasAbandoned));
    it('should abandon the import on the kernel after the chunks already sent', () => kernel.abandons.should.deep.equal([1]));
    it('should report the import as abandoned', () => result.state.should.equal(ImportState.Abandoned));
    it('should refuse to complete', () => completeError.should.be.instanceOf(ImportWasAbandoned));
    it('should not complete the import on the kernel', () => kernel.completions.should.be.empty);
});

describe('when adding to an abandoned import', () => {
    let error: unknown;
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        const session = kernel.session();
        await session.abandon();
        error = await session.add(numberedEvents(1)).catch(caught => caught);
    });

    it('should refuse the events', () => error.should.be.instanceOf(ImportWasAbandoned));
    it('should send nothing', () => kernel.chunks.should.be.empty);
});
