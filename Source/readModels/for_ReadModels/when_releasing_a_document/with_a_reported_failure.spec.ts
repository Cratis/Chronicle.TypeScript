// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

const should = chai.should();

describe.each(['kernel', 'transport'])('when releasing a document and a later subject reports a %s failure', failure => {
    let context: a_stored_read_model;
    let result: Record<string, unknown> | undefined;
    let error: Error;
    let document: Record<string, unknown>;
    let original: string;

    beforeEach(async () => {
        context = new a_stored_read_model();
        result = undefined;
        document = { name: 'encrypted name', email: 'encrypted email', __subjects: { name: 'owner', email: 'other-owner' } };
        original = JSON.stringify(document);
        context.release.mockResolvedValueOnce({ HasError: false, Error: '', Payload: '{"name":"released name"}' });
        if (failure === 'kernel') {
            context.release.mockResolvedValueOnce({ HasError: true, Error: 'PII private@example.test', Payload: '{"email":"private@example.test"}' });
        } else {
            context.release.mockRejectedValueOnce(new Error('Transport details: private@example.test'));
        }
        await context.readModels.releaseDocument(AccountDocument, document).then(
            released => { result = released; }, caught => { error = caught as Error; }
        );
    });

    it('should have attempted both subjects', () => context.release.mock.calls.should.have.lengthOf(2));
    it('should reject the whole operation', () => error.should.be.instanceOf(Error));
    it('should never expose the earlier released group', () => should.not.exist(result));
    it('should leave the input unchanged even after a partial release', () => JSON.stringify(document).should.equal(original));
    it('should not expose PII from errors or payloads', () => error.message.should.equal('Failed to release PII in stored read model document.'));
    it('should not attach an unsafe cause', () => should.not.exist(error.cause));
});
