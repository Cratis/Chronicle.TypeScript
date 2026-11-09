// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { EventForEventSourceId } from '../../eventSequences/EventForEventSourceId.js';
import { ImportWasAbandoned } from '../ImportWasAbandoned.js';
import { a_kernel_import_session, numbered } from './given/a_kernel_import_session.js';

chai.should();

describe('when cancelling an add with an abort signal while the source stalls', () => {
    let kernel: a_kernel_import_session;
    let error: unknown;
    let reason: Error;
    let stillUsable: boolean;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        async function* stalling(): AsyncGenerator<EventForEventSourceId> {
            yield numbered(0);
            yield numbered(1);
            yield numbered(2);
            await new Promise(() => undefined);
        }
        const controller = new AbortController();
        reason = new Error('the operator cancelled');
        const session = kernel.session({ maxChunkEvents: 2 });
        const adding = session.add(stalling(), controller.signal).catch(caught => caught);
        await new Promise(resolve => setTimeout(resolve, 10));
        controller.abort(reason);
        error = await adding;
        await session.add([numbered(3)]);
        await session.complete();
        stillUsable = true;
    });

    it('should stop with the reason it was cancelled for', () => error!.should.equal(reason));
    it('should not report the import as abandoned', () => error!.should.not.be.instanceOf(ImportWasAbandoned));
    it('should keep the chunks already handed to the kernel', () => kernel.chunks[0].contents.length.should.equal(2));
    it('should leave the session usable', () => stillUsable.should.be.true);
});

describe('when cancelling completion with an abort signal while waiting for the commit', () => {
    let error: unknown;
    let reason: Error;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        kernel.reads = [{ State: 3 }];
        const controller = new AbortController();
        reason = new Error('stop waiting');
        const session = kernel.session({ pollInterval: 5 });
        await session.add([numbered(0)]);
        const completing = session.complete(controller.signal).catch(caught => caught);
        await new Promise(resolve => setTimeout(resolve, 20));
        controller.abort(reason);
        error = await completing;
    });

    it('should stop waiting with the reason it was cancelled for', () => error!.should.equal(reason));
});
