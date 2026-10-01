// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a frozen document', () => {
    let document: Readonly<Record<string, unknown>>;
    let result: Record<string, unknown>;
    let original: string;

    beforeEach(async () => {
        const context = new a_stored_read_model();
        document = Object.freeze({
            name: 'encrypted name', contact: Object.freeze({ phone: 'unchanged phone' }),
            __subjects: Object.freeze({ name: 'owner' })
        });
        original = JSON.stringify(document);
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: '{"name":"released name"}' });
        result = await context.readModels.releaseDocument(AccountDocument, document);
    });

    it('should not mutate the document or its metadata', () => JSON.stringify(document).should.equal(original));
    it('should release into a separate document', () => result.should.deep.equal({ name: 'released name', contact: { phone: 'unchanged phone' } }));
    it('should copy even the subtrees that are not released', () => result.contact!.should.not.equal(document.contact));
});
