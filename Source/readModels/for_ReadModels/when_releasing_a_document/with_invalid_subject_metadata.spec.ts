// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe.each([
    { __subject: 42 }, { __subject: false }, { __subject: [] }, { __subject: {} },
    { __subjects: { name: 42 } }, { __subjects: { name: false } },
    { __subjects: { name: [] } }, { __subjects: { name: { subject: 'private@example.test' } } },
    { __subjects: { email: 42 } }, { __subjects: { removedProperty: 42 } }
])('when releasing a document with invalid subject metadata %j', metadata => {
    let context: a_stored_read_model;
    let error: Error;

    beforeEach(async () => {
        context = new a_stored_read_model();
        await context.readModels.releaseDocument(AccountDocument, { name: 'encrypted name', ...metadata })
            .catch(caught => { error = caught as Error; });
    });

    it('should reject the document', () => error.should.be.instanceOf(Error));
    it('should not expose metadata values in the error', () => error.message.should.not.contain('private@example.test'));
    it('should not attempt release with invalid metadata', () => context.release.mock.calls.should.have.lengthOf(0));
});
