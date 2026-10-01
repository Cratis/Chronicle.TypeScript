// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

const should = chai.should();

describe.each([
    '{}',
    '{"name":"wrong group"}',
    '{"email":"released email","name":"overwrite released group"}',
    '{"email":"released email","id":"overwrite unreleased property"}',
    '{"email":"released email","__proto__":{"polluted":true}}'
])('when releasing a document with missing or conflicting response properties %s', payload => {
    let result: Record<string, unknown> | undefined;
    let error: Error;

    beforeEach(async () => {
        const context = new a_stored_read_model();
        result = undefined;
        context.release.mockResolvedValueOnce({ HasError: false, Error: '', Payload: '{"name":"released name"}' });
        context.release.mockResolvedValueOnce({ HasError: false, Error: '', Payload: payload });
        await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'encrypted name', email: 'encrypted email',
            __subjects: { name: 'owner', email: 'other-owner' }
        }).then(released => { result = released; }, caught => { error = caught as Error; });
    });

    it('should reject the whole operation', () => error.message.should.equal('Failed to release stored read model document: missing or conflicting properties.'));
    it('should not expose a partial result', () => should.not.exist(result));
});
