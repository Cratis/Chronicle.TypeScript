// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { JsonSchemaGenerator } from '../../../schemas/index.js';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a document with property subjects', () => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockImplementation(async request => ({
            HasError: false, Error: '', Payload: JSON.stringify(request.Subject === 'owner'
                ? { name: 'released name', email: 'released email' }
                : { contact: { phone: 'released phone' }, contacts: [{ phone: 'released list phone' }] })
        }));
        result = await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'encrypted name', email: 'encrypted email',
            contact: { phone: 'encrypted phone' }, contacts: [{ phone: 'encrypted list phone' }],
            __subjects: { name: 'owner', email: 'owner', contact: 'contact-owner', contacts: 'contact-owner' }
        });
    });

    it('should batch properties by distinct subject', () => context.release.mock.calls.should.have.lengthOf(2));
    it('should send only the owner properties to that subject', () => {
        JSON.parse(context.requestFor('owner').Payload).should.deep.equal({ name: 'encrypted name', email: 'encrypted email' });
    });
    it('should release each nested subtree and array under its top-level subject', () => {
        JSON.parse(context.requestFor('contact-owner').Payload).should.deep.equal({
            contact: { phone: 'encrypted phone' }, contacts: [{ phone: 'encrypted list phone' }]
        });
    });
    it('should retain nested compliance schemas', () => {
        const properties = JsonSchemaGenerator.generate(AccountDocument).properties!;
        JSON.parse(context.requestFor('contact-owner').Schema).properties.should.deep.equal({
            contact: properties.contact, contacts: properties.contacts
        });
    });
    it('should include the array item phone PII metadata in the subject-specific schema', () => {
        JSON.parse(context.requestFor('contact-owner').Schema).properties.contacts.items.properties.phone.should.deep.equal({
            type: 'string', compliance: [{ metadataType: 'PII', details: '' }]
        });
    });
    it('should combine the released groups and retain properties without a subject', () => result.should.deep.equal({
        id: 'account', name: 'released name', email: 'released email',
        contact: { phone: 'released phone' }, contacts: [{ phone: 'released list phone' }]
    }));
});
