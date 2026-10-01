// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

const should = chai.should();

describe.each(['private@example.test', '', 'null', '[]', '"private@example.test"', '42'])('when releasing a document with malformed response %s', payload => {
    let result: Record<string, unknown> | undefined;
    let error: Error;

    beforeEach(async () => {
        const context = new a_stored_read_model();
        result = undefined;
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: payload });
        await context.readModels.releaseDocument(AccountDocument, { name: 'encrypted name', __subject: 'owner' }).then(
            released => { result = released; }, caught => { error = caught as Error; }
        );
    });

    it('should reject without returning data', () => should.not.exist(result));
    it('should sanitize parsing failures', () => error.message.should.equal('Failed to release PII in stored read model document.'));
});
