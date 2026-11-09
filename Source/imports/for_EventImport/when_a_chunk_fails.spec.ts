// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClientError, Status } from 'nice-grpc-common';
import { beforeEach, chai, describe, it } from 'vitest';
import { ImportChunkRefused } from '../ImportChunkRefused.js';
import { a_kernel_import_session, contentsOf, numberedEvents } from './given/a_kernel_import_session.js';

chai.should();

describe('when a chunk fails because the connection dropped', () => {
    let kernel: a_kernel_import_session;
    let attempts: number[];
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        attempts = [];
        kernel.answerChunk = async request => {
            attempts.push(request.ChunkIndex);
            if (request.ChunkIndex === 1 && attempts.filter(index => index === 1).length < 3) {
                throw new ClientError('/Imports/AddImportChunk', Status.UNAVAILABLE, 'connection reset');
            }
            return { Error: '' };
        };
        const session = kernel.session({ maxChunkEvents: 2 });
        await session.add(numberedEvents(6));
        await session.complete();
    });

    it('should send the same chunk again', () => attempts.filter(index => index === 1).length.should.equal(3));
    it('should send every event once, in order', () => kernel.receivedContents.should.deep.equal(contentsOf(6)));
});

describe('when a chunk keeps failing because the connection dropped', () => {
    let error: unknown;
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        kernel.answerChunk = async () => { throw new ClientError('/Imports/AddImportChunk', Status.UNAVAILABLE, 'down'); };
        const session = kernel.session({ options: { maxChunkAttempts: 2 } });
        await session.add(numberedEvents(1));
        error = await session.complete().catch(caught => caught);
    });

    it('should fail completing with the connection failure', () => (error as ClientError).code.should.equal(Status.UNAVAILABLE));
    it('should not complete the import on the kernel', () => kernel.completions.should.be.empty);
});

describe('when the kernel refuses a chunk', () => {
    let error: unknown;
    let attempts: number;
    let kernel: a_kernel_import_session;
    beforeEach(async () => {
        kernel = new a_kernel_import_session();
        attempts = 0;
        kernel.answerChunk = async () => { attempts++; return { Error: 'The import is not staging' }; };
        const session = kernel.session();
        await session.add(numberedEvents(1));
        error = await session.complete().catch(caught => caught);
    });

    it('should fail completing with the refusal', () => error.should.be.instanceOf(ImportChunkRefused));
    it('should carry the reason', () => (error as ImportChunkRefused).reason.should.equal('The import is not staging'));
    it('should not send the chunk again', () => attempts.should.equal(1));
    it('should not complete the import on the kernel', () => kernel.completions.should.be.empty);
});
