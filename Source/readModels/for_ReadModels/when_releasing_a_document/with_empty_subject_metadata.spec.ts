// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe.each([
    { __subject: null }, { __subject: '' },
    { __subjects: { name: null } }, { __subjects: { name: '' } },
    { __subjects: null }, { __subjects: [] }, { __subjects: 'owner' }, { __subjects: 42 }
])('when releasing a document without usable subject metadata %j', metadata => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        result = await context.readModels.releaseDocument(AccountDocument, { name: 'stored name', ...metadata });
    });

    it('should copy properties without a subject unchanged', () => result.should.deep.equal({ name: 'stored name' }));
    it('should not attempt release', () => context.release.mock.calls.should.have.lengthOf(0));
});

describe.each([null, ''])('when releasing a document with an empty property subject %j and a default subject', subject => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: JSON.stringify({ name: 'released name' }) });
        result = await context.readModels.releaseDocument(AccountDocument, {
            name: 'encrypted name', __subject: 'owner', __subjects: { name: subject }
        });
    });

    it('should fall back to the default subject', () => context.requestFor('owner').Subject.should.equal('owner'));
    it('should release the property', () => result.should.deep.equal({ name: 'released name' }));
});

describe.each([null, ''])('when releasing a document with an empty default subject %j and a property subject', subject => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: JSON.stringify({ name: 'released name' }) });
        result = await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'encrypted name', __subject: subject, __subjects: { name: 'owner' }
        });
    });

    it('should release only the property with a subject', () => JSON.parse(context.requestFor('owner').Payload).should.deep.equal({ name: 'encrypted name' }));
    it('should retain properties without a subject', () => result.should.deep.equal({ id: 'account', name: 'released name' }));
});
