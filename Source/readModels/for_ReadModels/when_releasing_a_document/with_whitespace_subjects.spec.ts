// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe.each([
    { __subject: '  \t' },
    { __subject: 'owner', __subjects: { name: '  \t' } }
])('when releasing a document with a whitespace-only subject %j', metadata => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: JSON.stringify({ name: 'released name' }) });
        result = await context.readModels.releaseDocument(AccountDocument, { name: 'encrypted name', ...metadata });
    });

    it('should preserve the exact subject in the release request', () => context.requestFor('  \t').Subject.should.equal('  \t'));
    it('should release the property', () => result.should.deep.equal({ name: 'released name' }));
});
