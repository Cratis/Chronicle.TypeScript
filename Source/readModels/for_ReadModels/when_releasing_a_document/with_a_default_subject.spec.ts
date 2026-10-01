// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import { JsonSchemaGenerator } from '../../../schemas/index.js';
import { AccountDocument, a_stored_read_model } from '../given/a_stored_read_model.js';

chai.should();

describe('when releasing a document with a default subject', () => {
    let context: a_stored_read_model;
    let result: Record<string, unknown>;

    beforeEach(async () => {
        context = new a_stored_read_model();
        context.release.mockResolvedValue({ HasError: false, Error: '', Payload: '{"id":"account","name":"released name"}' });
        result = await context.readModels.releaseDocument(AccountDocument, {
            id: 'account', name: 'encrypted name', __subject: 'owner'
        });
    });

    it('should release all present properties together', () => context.release.mock.calls.should.have.lengthOf(1));
    it('should use the stored subject rather than the id', () => context.requestFor('owner').Subject.should.equal('owner'));
    it('should use the current event store and namespace', () => {
        const { EventStore, Namespace } = context.requestFor('owner');
        ({ EventStore, Namespace }).should.deep.equal({ EventStore: 'store', Namespace: 'tenant' });
    });
    it('should send only data properties', () => JSON.parse(context.requestFor('owner').Payload).should.deep.equal({ id: 'account', name: 'encrypted name' }));
    it('should preserve compliance metadata in the relevant schema', () => {
        const schema = JsonSchemaGenerator.generate(AccountDocument);
        JSON.parse(context.requestFor('owner').Schema).should.deep.equal({
            ...schema,
            properties: { id: schema.properties!.id, name: schema.properties!.name },
            required: ['id', 'name']
        });
    });
    it('should return the released values', () => result.should.deep.equal({ id: 'account', name: 'released name' }));
    it('should return a plain document rather than a model instance', () => Object.getPrototypeOf(result).should.equal(Object.prototype));
});
