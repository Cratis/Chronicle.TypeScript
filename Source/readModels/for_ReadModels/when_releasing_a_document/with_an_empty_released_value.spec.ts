// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a document and the kernel reports success with an empty value', () => {
    let result: Record<string, unknown>;

    beforeEach(async () => {
        const context = new a_stored_read_model();
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: '{"name":""}' });
        result = await context.readModels.releaseDocument(AccountDocument, { name: 'encrypted name', __subject: 'owner' });
    });

    it('should accept the reported success without guessing whether decryption failed', () => result.should.deep.equal({ name: '' }));
});
