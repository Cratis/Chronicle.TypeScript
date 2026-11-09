// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ClientError, Status } from 'nice-grpc-common';
import { beforeEach, chai, describe, it } from 'vitest';
import { beginEventImport } from '../beginEventImport.js';
import { ImportCouldNotBegin } from '../ImportCouldNotBegin.js';
import { ImportsNotSupported } from '../ImportsNotSupported.js';
import { a_kernel_import_session } from '../for_EventImport/given/a_kernel_import_session.js';

chai.should();

describe('when beginning an import on a kernel that does not serve imports', () => {
    let error: unknown;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        const imports = { ...kernel.imports, beginImport: async () => { throw new ClientError('/Imports/BeginImport', Status.UNIMPLEMENTED, ''); } };
        error = await beginEventImport({ imports: imports as never, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' })
            .catch(caught => caught);
    });

    it('should say imports are not supported', () => error.should.be.instanceOf(ImportsNotSupported));
});

describe('when the kernel refuses to begin an import', () => {
    let error: unknown;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        const imports = { ...kernel.imports, beginImport: async () => ({ IsAuthorized: true, ValidationResults: [], ExceptionMessages: [],
            ExceptionStackTrace: '', AuthorizationFailureReason: '', CorrelationId: undefined,
            Response: { ImportId: undefined, State: 0, MaxChunkEvents: 0, MaxChunkBytes: 0, Error: 'Imports into the outbox are not supported' } }) };
        error = await beginEventImport({ imports: imports as never, eventStore: 'store', namespace: 'default', eventSequenceId: 'outbox' })
            .catch(caught => caught);
    });

    it('should say it could not begin', () => error.should.be.instanceOf(ImportCouldNotBegin));
    it('should carry the reason', () => (error as ImportCouldNotBegin).reason.should.equal('Imports into the outbox are not supported'));
});

describe('when beginning an import with a signal that already aborted', () => {
    let error: unknown;
    let called: boolean;
    beforeEach(async () => {
        const kernel = new a_kernel_import_session();
        called = false;
        const imports = { ...kernel.imports, beginImport: async () => { called = true; throw new Error('should not be called'); } };
        const controller = new AbortController();
        controller.abort(new Error('cancelled before it began'));
        error = await beginEventImport({ imports: imports as never, eventStore: 'store', namespace: 'default', eventSequenceId: 'event-log' },
            { signal: controller.signal }).catch(caught => caught);
    });

    it('should not call the kernel', () => called.should.be.false);
    it('should stop with the reason', () => (error as Error).message.should.equal('cancelled before it began'));
});
