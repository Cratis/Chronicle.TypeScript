// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { sizeOfImportEvent } from '../sizeOfImportEvent.js';
import { a_kernel_import_session, contentsOf, numberedEvents, wireEventFor } from './given/a_kernel_import_session.js';

chai.should();

describe('when cutting events into chunks within the kernel event limit', () => {
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        const session = kernel.session({ maxChunkEvents: 3 });
        await session.add(numberedEvents(10));
        await session.complete();
    });

    it('should send chunks of at most the limit', () => kernel.chunks.map(chunk => chunk.contents.length).sort().should.deep.equal([1, 3, 3, 3]));
    it('should number the chunks in order', () => kernel.chunks.map(chunk => chunk.chunkIndex).sort().should.deep.equal([0, 1, 2, 3]));
    it('should give each chunk the index of its first event', () =>
        [...kernel.chunks].sort((left, right) => left.chunkIndex - right.chunkIndex).map(chunk => chunk.firstEventIndex)
            .should.deep.equal([0n, 3n, 6n, 9n]));
    it('should send every event once, in order', () => kernel.receivedContents.should.deep.equal(contentsOf(10)));
    it('should complete with the chunks and events it sent', () =>
        kernel.completions.should.deep.equal([{ ExpectedChunks: 4, ExpectedEvents: 10n }]));
});

describe('when cutting events into chunks within the kernel byte limit', () => {
    let kernel: a_kernel_import_session;
    let limit: number;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        limit = sizeOfImportEvent(wireEventFor(numberedEvents(1)[0])) * 2;
        const session = kernel.session({ maxChunkBytes: limit });
        await session.add(numberedEvents(5));
        await session.complete();
    });

    it('should keep each chunk within the limit', () =>
        kernel.chunks.every(chunk => chunk.contents.reduce((bytes, content) => bytes + Buffer.byteLength(content), 0) <= limit).should.be.true);
    it('should send every event once, in order', () => kernel.receivedContents.should.deep.equal(contentsOf(5)));
});

describe('when cutting events into chunks with a client limit below the kernel limit', () => {
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        const session = kernel.session({ maxChunkEvents: 100, options: { maxEventsPerChunk: 2 } });
        await session.add(numberedEvents(5));
        await session.complete();
    });

    it('should use the lower limit', () => kernel.chunks.map(chunk => chunk.contents.length).sort().should.deep.equal([1, 2, 2]));
});

describe('when adding events in several calls', () => {
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        const session = kernel.session({ maxChunkEvents: 4 });
        const events = numberedEvents(6);
        await session.add(events.slice(0, 3));
        await session.add((async function* () { yield* events.slice(3); })());
        await session.complete();
    });

    it('should fill chunks across the calls', () => kernel.chunks.map(chunk => chunk.contents.length).sort().should.deep.equal([2, 4]));
    it('should send every event once, in order', () => kernel.receivedContents.should.deep.equal(contentsOf(6)));
});
