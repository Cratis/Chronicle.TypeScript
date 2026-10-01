// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a document without subjects', () => {
    let context: a_stored_read_model;
    let document: Record<string, unknown>;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        document = { id: 'account', name: 'unchanged', contact: { phone: 'unchanged phone' } };
        result = await context.readModels.releaseDocument(AccountDocument, document);
    });

    it('should leave data values unchanged', () => result.should.deep.equal(document));
    it('should not infer a subject from id or subject decorators', () => context.release.mock.calls.should.have.lengthOf(0));
    it('should return a copy', () => result.should.not.equal(document));
    it('should not share unreleased subtrees with the input', () => result.contact!.should.not.equal(document.contact));
});
