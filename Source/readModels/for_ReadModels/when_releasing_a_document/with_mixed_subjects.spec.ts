// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a document with mixed default and property subjects', () => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockImplementation(async request => ({
            HasError: false, Error: '', Payload: JSON.stringify(request.Subject === 'owner'
                ? { id: 'account', name: 'released name' } : { email: 'released email' })
        }));
        result = await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'encrypted name', email: 'encrypted email',
            __subject: 'owner', __subjects: { name: 'owner', email: 'joined-owner' }
        });
    });

    it('should reuse the default subject group for matching property subjects', () => context.release.mock.calls.should.have.lengthOf(2));
    it('should apply the default to unmapped properties', () => {
        JSON.parse(context.requestFor('owner').Payload).should.deep.equal({ id: 'account', name: 'encrypted name' });
    });
    it('should override the default for mapped properties', () => {
        JSON.parse(context.requestFor('joined-owner').Payload).should.deep.equal({ email: 'encrypted email' });
    });
    it('should send a schema limited to the overridden property', () => {
        Object.keys(JSON.parse(context.requestFor('joined-owner').Schema).properties).should.deep.equal(['email']);
    });
    it('should merge the released properties without bookkeeping', () => result.should.deep.equal({
        id: 'account', name: 'released name', email: 'released email'
    }));
});
