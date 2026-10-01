// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe.each(['unknown', 'contact.phone', '__subject', '__subjects', 'toString'])('when releasing a document with unknown subject property %s', property => {
    let context: a_stored_read_model;
    let error: Error;

    beforeEach(async () => {
        context = new a_stored_read_model();
        await context.readModels.releaseDocument(AccountDocument, {
            name: 'encrypted name', contact: { phone: 'encrypted phone' }, unknown: 'not declared',
            'contact.phone': 'not declared', toString: 'not declared',
            __subject: 'owner', __subjects: { [property]: 'other-owner' }
        }).catch(caught => { error = caught as Error; });
    });

    it('should reject undeclared, nested, reserved and inherited property names', () => error.message.should.equal('Stored read model document has an unknown subject property.'));
    it('should validate the entire subject map before attempting any releases', () => context.release.mock.calls.should.have.lengthOf(0));
});

describe.each(['email', 'removedProperty', 'contact.phone', 'toString'])('when releasing a document with a stale subject property %s', property => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        result = await context.readModels.releaseDocument(AccountDocument, {
            name: 'encrypted name', __subject: 'owner', __subjects: { [property]: 'other-owner' }
        });
    });

    it('should ignore mappings without a corresponding document property', () => result.should.deep.equal({ name: 'encrypted name' }));
    it('should release only the existing properties under their subject', () => {
        context.release.mock.calls.should.have.lengthOf(1);
        JSON.parse(context.requestFor('owner').Payload).should.deep.equal({ name: 'encrypted name' });
    });
});
