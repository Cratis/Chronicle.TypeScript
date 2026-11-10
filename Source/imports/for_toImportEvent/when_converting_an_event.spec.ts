// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field, Guid } from '@cratis/fundamentals';
import type { ImportEvent } from '@cratis/chronicle.contracts';
import { beforeEach, chai, describe, it } from 'vitest';
import { fromContractsGuid } from '../../connection/Guid.js';
import { eventType } from '../../events/eventTypeDecorator.js';
import { NamedTag } from '../../events/NamedTag.js';
import { tag } from '../../events/tagDecorator.js';
import { Identity } from '../../identity/Identity.js';
import { toImportEvent } from '../toImportEvent.js';

chai.should();

@eventType('import-spec-customer-registered', 2)
@tag('migrated')
class CustomerRegistered {
    @field(String) name: string;
    constructor(name = '') { this.name = name; }
}

describe('when converting an event that carries what its source said', () => {
    const correlationId = Guid.create();
    const occurred = new Date('2019-05-06T07:08:09.000Z');
    let converted: ImportEvent;
    beforeEach(() => {
        converted = toImportEvent({
            eventSourceId: 'customer-1',
            event: new CustomerRegistered('Jane'),
            eventStreamType: 'Onboarding',
            eventStreamId: 'web',
            eventSourceType: 'Customer',
            occurred,
            subject: 'person-1',
            tags: ['legacy'],
            namedTags: [new NamedTag('region', 'north')],
            correlationId,
            causedBy: new Identity('user-1', 'Jane Doe', 'jane', new Identity('system', 'Migrator')),
            generation: 1,
            sourceSequenceNumber: 41
        });
    });

    it('should keep the event source', () => converted.EventSourceId.should.equal('customer-1'));
    it('should keep the route', () => [converted.EventSourceType, converted.EventStreamType, converted.EventStreamId]
        .should.deep.equal(['Customer', 'Onboarding', 'web']));
    it('should keep the event type', () => converted.EventType!.Id.should.equal('import-spec-customer-registered'));
    it('should keep the generation the event was written in', () => converted.EventType!.Generation.should.equal(1));
    it('should carry the content', () => JSON.parse(converted.Content).name.should.equal('Jane'));
    it('should keep when it occurred', () => converted.Occurred!.Value.should.equal(occurred.toISOString()));
    it('should keep the subject', () => converted.Subject.should.equal('person-1'));
    it('should combine its tags with the tags of its type', () => converted.Tags.should.have.members(['migrated', 'legacy']));
    it('should keep the named tags', () => converted.NamedTags.should.deep.equal([{ Name: 'region', Value: 'north' }]));
    it('should keep the correlation', () => fromContractsGuid(converted.CorrelationId).toString().should.equal(correlationId.toString()));
    it('should keep who caused it', () => converted.CausedBy!.Subject.should.equal('user-1'));
    it('should keep who it was caused on behalf of', () => converted.CausedBy!.OnBehalfOf!.Subject.should.equal('system'));
    it('should keep the sequence number it had in its source', () => converted.SourceSequenceNumber.should.equal(41n));
});

describe('when converting an event that says nothing about its source', () => {
    let converted: ImportEvent;
    beforeEach(() => {
        converted = toImportEvent({ eventSourceId: 'customer-2', event: new CustomerRegistered('John') });
    });

    it('should use the generation its type is registered with', () => converted.EventType!.Generation.should.equal(2));
    it('should leave the occurrence time to the kernel', () => (converted.Occurred === undefined).should.be.true);
    it('should leave the correlation to the kernel', () => (converted.CorrelationId === undefined).should.be.true);
    it('should leave who caused it to the kernel', () => (converted.CausedBy === undefined).should.be.true);
    it('should carry no source sequence number', () => converted.SourceSequenceNumber.should.equal(0n));
    it('should leave the route to the kernel', () => [converted.EventSourceType, converted.EventStreamType, converted.EventStreamId]
        .should.deep.equal(['', '', '']));
});
