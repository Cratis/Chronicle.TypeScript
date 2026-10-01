// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe.each([undefined, 'owner'])('when releasing a document with bookkeeping and default subject %s', defaultSubject => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        result = await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'stored name', _id: 'storage-id', __generation: 1,
            __subject: defaultSubject, __subjects: {}
        });
    });

    it('should strip storage-only and subject metadata', () => result.should.deep.equal({ id: 'account', name: 'stored name' }));
    it('should never send bookkeeping for release', () => {
        context.release.mock.calls.forEach(([request]) => {
            JSON.parse(request.Payload).should.deep.equal({ id: 'account', name: 'stored name' });
        });
    });
});
