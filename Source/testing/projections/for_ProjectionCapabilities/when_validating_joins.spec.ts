// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { AutoMap, ReadModelObserverType, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { chai, describe, it } from 'vitest';
import { EventType } from '../../../events/EventType.js';
import type { EventContext } from '../../../events/EventContext.js';
import { buildReadModelDefinition } from '../../../readModels/buildReadModelDefinition.js';
import type { CompiledProjectionDefinitions } from '../../../projections/CompiledProjectionDefinitions.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();
declare global {
    interface Object { should: Chai.Assertion; }
}

function fixture() {
    return JSON.parse(readFileSync(new URL('../fixtures/joins-lifecycle.json', import.meta.url), 'utf8')) as {
        wireDefinition: Omit<ProjectionDefinition, 'Join' | 'From' | 'RemovedWith' | 'All'> & {
            All: NonNullable<ProjectionDefinition['All']>;
            Join: { Key: NonNullable<ProjectionDefinition['Join'][number]['Key']>; Value: NonNullable<ProjectionDefinition['Join'][number]['Value']> }[];
            From: { Key: NonNullable<ProjectionDefinition['From'][number]['Key']>; Value: NonNullable<ProjectionDefinition['From'][number]['Value']> }[];
            RemovedWith: { Key: NonNullable<ProjectionDefinition['RemovedWith'][number]['Key']>; Value: NonNullable<ProjectionDefinition['RemovedWith'][number]['Value']> }[];
        };
        readModel: { schema: JsonSchema };
        eventSchemas: { eventType: { Id: string; Generation: number }; schema: JsonSchema }[];
    };
}

function create(value: ReturnType<typeof fixture>) {
    const definition = value.wireDefinition;
    const compiled: CompiledProjectionDefinitions = {
        definitions: [definition],
        readModels: [buildReadModelDefinition({ identifier: definition.ReadModel, schema: JSON.stringify(value.readModel.schema),
            sinkTypeId: 'test', observerType: ReadModelObserverType.Projection, observerIdentifier: definition.Identifier })],
        provenance: new Map([[definition, [{ contractPath: 'Join[CustomerNamed:1]', declaration: '.join' }]]]),
        eventSchemas: new Map([[definition, new Map(value.eventSchemas.map(entry => [`${entry.eventType.Id}:${entry.eventType.Generation}:0`,
            { eventType: { ...entry.eventType, Tombstone: false }, schema: entry.schema }]))]])
    };
    return new ProjectionReadModelProcessor(class Order {}, compiled, definition);
}

describe('when validating joins before replay', () => {
    it('should accept the captured root join without replaying any events', () => {
        (() => create(fixture())).should.not.throw();
    });

    for (const key of ['name', '$value(customer)', '$eventContext(EventSourceId)', '$context.eventSourceId', '']) {
        it(`should reject the unproven join key ${key}`, () => {
            const value = fixture();
            value.wireDefinition.Join[0].Value.Key = key;
            (() => create(value)).should.throw(UnsupportedProjectionOperation).with.property('message')
                .that.includes('Join[CustomerNamed:1].Key (.join)').and.includes('join keys other than $eventSourceId');
        });
    }

    const cases: { name: string; change: (value: ReturnType<typeof fixture>) => void; reason: string }[] = [
        { name: 'empty joins', change: value => { value.wireDefinition.Join[0].Value.Properties = {}; }, reason: 'joins without effective property mappings' },
        { name: 'unknown join AutoMap', change: value => { value.wireDefinition.Join[0].Value.AutoMap = 99 as AutoMap; }, reason: 'unknown join AutoMap settings' },
        { name: 'unmapped protected join fields', change: value => { value.eventSchemas[1].schema.properties!.ignored.security = [{ metadataType: 'EncryptedSubject', details: '' }]; }, reason: 'protected fields' },
        { name: 'multiple joins', change: value => value.wireDefinition.Join.push(structuredClone(value.wireDefinition.Join[0])), reason: 'multiple join subscriptions' },
        { name: 'join-only projections', change: value => { value.wireDefinition.From = []; }, reason: 'joins require a From mapping' },
        { name: 'initial values', change: value => { value.wireDefinition.InitialModelState = '{"title":"seed"}'; }, reason: 'joins with initial model state' },
        { name: 'identifier joins', change: value => { value.wireDefinition.Join[0].Value.On = 'id'; }, reason: 'direct non-identifier' },
        { name: 'nested joins', change: value => { value.wireDefinition.Join[0].Value.On = 'customer.id'; }, reason: 'direct non-identifier' },
        { name: 'unknown join targets', change: value => { value.wireDefinition.Join[0].Value.On = 'missing'; }, reason: 'direct non-identifier' },
        { name: 'GUID roots', change: value => { value.readModel.schema.properties!.id.format = 'guid'; }, reason: 'plain string read-model properties' },
        { name: 'numeric targets', change: value => { value.readModel.schema.properties!.customerName = { type: 'number' }; }, reason: 'plain string read-model properties' },
        { name: 'numeric sources', change: value => { value.eventSchemas[1].schema.properties!.name = { type: 'number' }; }, reason: 'direct plain string event-property mappings' },
        { name: 'nullable targets', change: value => { value.readModel.schema.properties!.customerName.type = ['string', 'null'] as unknown as JsonSchema['type']; }, reason: 'plain string read-model properties' },
        { name: 'case-colliding sources', change: value => { value.eventSchemas[1].schema.properties!.Name = { type: 'string' }; }, reason: 'colliding join event properties' },
        { name: 'protected sources', change: value => { value.eventSchemas[1].schema.properties!.name.security = [{ metadataType: 'EncryptedSubject', details: '' }]; }, reason: 'protected fields' },
        { name: 'overlapping From and Join events', change: value => { value.wireDefinition.Join[0].Key = value.wireDefinition.From[0].Key; }, reason: 'events shared between Join' },
        { name: 'overlapping removal and Join events', change: value => { value.wireDefinition.Join[0].Key = value.wireDefinition.RemovedWith[0].Key; }, reason: 'events shared between Join' },
        { name: 'overlapping target mappings', change: value => { value.wireDefinition.From[0].Value.Properties.customerName = 'title'; }, reason: 'From and Join mapping the same property' },
        { name: 'overlapping AutoMap targets', change: value => { value.wireDefinition.AutoMap = AutoMap.Enabled; value.eventSchemas[0].schema.properties!.customerName = { type: 'string' }; }, reason: 'From and Join mapping the same property' },
        { name: 'join target mutation', change: value => { value.wireDefinition.Join[0].Value.Properties.customerId = 'name'; }, reason: 'cannot map its own join target' },
        { name: 'root arithmetic', change: value => { value.wireDefinition.From[0].Value.Properties.title = '$count'; }, reason: 'joins combined with arithmetic' },
        { name: 'join arithmetic', change: value => { value.wireDefinition.Join[0].Value.Properties.customerName = '$add(amount)'; }, reason: 'joins combined with arithmetic' },
        { name: 'removedWithJoin', change: value => { value.wireDefinition.RemovedWithJoin = [{ Key: value.wireDefinition.Join[0].Key, Value: { Key: '$eventSourceId' } }]; }, reason: 'removedWithJoin require' },
        { name: 'children combined with joins', change: value => { value.wireDefinition.Children = { items: {} as ProjectionDefinition['Children'][string] }; }, reason: 'root joins combined with children' },
        { name: 'fromEvery combined with joins', change: value => { value.wireDefinition.All.Properties.title = 'title'; }, reason: 'fromEvery/all' },
        { name: 'constant root keys', change: value => { value.wireDefinition.From[0].Value.Key = '$value(all)'; }, reason: 'only $eventSourceId keys' },
        { name: 'root parent keys', change: value => { value.wireDefinition.From[0].Value.ParentKey = 'title'; }, reason: 'parent keys require' }
    ];
    for (const testCase of cases) {
        it(`should reject ${testCase.name} without history`, () => {
            const value = fixture();
            testCase.change(value);
            (() => create(value)).should.throw(UnsupportedProjectionOperation).with.property('message').that.includes(testCase.reason);
        });
    }

    it('should reject a seeded join event from another generation even before a root exists', async () => {
        const processor = create(fixture());
        await processor.process([{ sourceId: 'customer', content: { name: 'unsupported' }, context: {
            eventType: EventType.parse('CustomerNamed+2'), sequenceNumber: 0n, eventSourceId: 'customer'
        } as EventContext }]).then(
            () => { throw new Error('Expected rejection'); },
            error => {
                (error as Error).should.be.instanceOf(UnsupportedProjectionOperation);
                (error as Error).message.should.include('Join[CustomerNamed:1] (.join)').and.include('seeded event generation 2');
            }
        );
    });

    for (const expression of ['$eventSourceId', '$eventContext(Subject)', '$value(fixed)', '$null', 'nested.name', 'missing']) {
        it(`should reject unproven join mapping ${expression}`, () => {
            const value = fixture();
            value.wireDefinition.Join[0].Value.Properties.customerName = expression;
            (() => create(value)).should.throw(UnsupportedProjectionOperation).with.property('message')
                .that.includes('Join[CustomerNamed:1].Properties.customerName (.join)').and.includes('direct plain string');
        });
    }
});
