// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { EventForEventSourceId } from '../../eventSequences/EventForEventSourceId.js';
import { a_kernel_import_session, contentsOf, gate, numbered } from './given/a_kernel_import_session.js';

chai.should();

describe('when keeping chunks in flight', () => {
    let kernel: a_kernel_import_session;
    let readWhileHeld: number;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        const held = gate();
        kernel.answerChunk = async () => { await held.promise; return { Error: '' }; };
        let read = 0;
        async function* source(): AsyncGenerator<EventForEventSourceId> {
            for (let index = 0; index < 40; index++) {
                read++;
                yield numbered(index);
            }
        }
        const session = kernel.session({ maxChunkEvents: 2 });
        const adding = session.add(source());
        await new Promise(resolve => setTimeout(resolve, 20));
        readWhileHeld = read;
        held.open();
        await adding;
        await session.complete();
    });

    it('should have at most four chunks in flight', () => kernel.maxInFlight.should.equal(4));
    it('should stop reading the source while the kernel holds the chunks', () => readWhileHeld.should.be.at.most(4 * 2 + 3));
    it('should send every event once, in order', () => kernel.receivedContents.should.deep.equal(contentsOf(40)));
});

describe('when keeping chunks in flight with a configured bound', () => {
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.answerChunk = async () => { await new Promise(resolve => setTimeout(resolve, 1)); return { Error: '' }; };
        const session = kernel.session({ maxChunkEvents: 1, options: { maxChunksInFlight: 2 } });
        await session.add(Array.from({ length: 12 }, (_, index) => numbered(index)));
        await session.complete();
    });

    it('should have at most the configured number in flight', () => kernel.maxInFlight.should.equal(2));
});
