// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { chai, describe, it } from 'vitest';
import { EventType } from '../../../events/EventType.js';
import { fluent, Model } from '../../for_ReadModelScenario/when_keying_children_from_context/given/compiled_projection.js';
import type { ScenarioEvent } from '../../ScenarioEvent.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();
type Compiled = ReturnType<typeof fluent.compile>;
type Candidate = { compiled: Compiled; definition: Compiled['definitions'][number]; schema: JsonSchema };
type Mutation = (candidate: Candidate) => void;
const boundaries: Array<[string, Mutation]> = [
    ...['$eventSourceId', '$value(A)', '$composite(name)', '$eventContext(eventSourceId)', '$eventContext(EventSourceId.Value)',
        '$eventContext(Subject)', '$eventContext(SequenceNumber)', '$eventContext(EventSourceId).Value'].flatMap(expression => [
        [`creation key ${expression}`, ({ definition }: Candidate) => { definition.Children.items.From[0].Value.Key = expression; }],
        [`removal key ${expression}`, ({ definition }: Candidate) => { definition.Children.items.RemovedWith[0].Value.Key = expression; }]
    ] as Array<[string, Mutation]>),
    ['mixed content and context keys', ({ definition, compiled }) => {
        definition.Children.items.RemovedWith[0].Value.Key = 'name';
        compiled.eventSchemas.get(definition)!.get('ContextChildRemoved:1:0')!.schema.properties = { name: { type: 'string' } };
    }],
    ['multiple collections', ({ definition }) => { definition.Children.other = structuredClone(definition.Children.items); }],
    ['child before parent overlap', ({ definition }) => { definition.From[0].Key = definition.Children.items.From[0].Key; }],
    ['custom child parent key', ({ definition }) => { definition.Children.items.From[0].Value.ParentKey = 'name'; }],
    ['custom removal parent key', ({ definition }) => { definition.Children.items.RemovedWith[0].Value.ParentKey = 'name'; }],
    ['custom root key', ({ definition }) => { definition.From[0].Value.Key = 'title'; }],
    ['untyped items', ({ schema }) => { delete schema.properties!.items.items!.properties; }],
    ['missing child identifier', ({ schema }) => { delete schema.properties!.items.items!.properties!.itemId; }],
    ['nested child identifier', ({ definition }) => { definition.Children.items.IdentifiedBy = 'identity.itemId'; }],
    ['numeric child identifier', ({ schema }) => { schema.properties!.items.items!.properties!.itemId = { type: 'number' }; }],
    ['formatted child identifier', ({ schema }) => { schema.properties!.items.items!.properties!.itemId.format = 'uuid'; }],
    ['nullable child identifier', ({ schema }) => { schema.properties!.items.items!.properties!.itemId.type = ['string', 'null']; }],
    ['non-string child property', ({ schema }) => { schema.properties!.items.items!.properties!.name = { type: 'number' }; }],
    ['non-string root property', ({ schema }) => { schema.properties!.name = { type: 'number' }; }],
    ['disabled child AutoMap', ({ definition }) => { definition.Children.items.AutoMap = AutoMap.Disabled; }],
    ['child AutoMap exclusion', ({ definition }) => { definition.Children.items.NoAutoMapProperties = ['name']; }],
    ['payload AutoMap colliding with child identifier', ({ compiled, definition }) => {
        compiled.eventSchemas.get(definition)!.get('ContextChildChanged:1:0')!.schema.properties!.itemId = { type: 'string' };
    }],
    ['explicit non-identifier mapping', ({ definition }) => { definition.Children.items.From[0].Value.Properties.name = 'name'; }],
    ['wrong identifier mapping', ({ definition }) => { definition.Children.items.From[0].Value.Properties.itemId = 'name'; }],
    ['initial state', ({ definition }) => { definition.InitialModelState = '{"items":[]}'; }],
    ['root join', ({ definition }) => { definition.Join.push({ Key: definition.From[0].Key, Value: { On: 'id', Properties: {}, Key: '$eventSourceId' } }); }],
    ['child join', ({ definition }) => { definition.Children.items.Join.push({}); }],
    ['nested child collection', ({ definition }) => { definition.Children.items.Children.nested = structuredClone(definition.Children.items); }],
    ['root All', ({ definition }) => { definition.All = { Properties: { name: '$eventContext(SequenceNumber)' }, AutoMap: AutoMap.Inherit, IncludeChildren: true }; }],
    ['root arithmetic', ({ definition }) => { definition.From[0].Value.Properties.name = '$count'; }],
    ['root constant', ({ definition }) => { definition.From[0].Value.Properties.name = '$value(fixed)'; }],
    ['root context mapping', ({ definition }) => { definition.From[0].Value.Properties.name = '$eventContext(Subject)'; }]
];
const seeded: ScenarioEvent = {
    sourceId: 'A', content: { name: 'before-parent' },
    context: {
        eventSourceId: 'A', eventType: EventType.parse('ContextChildChanged+1'), sequenceNumber: 0n,
        occurred: new Date('2025-01-01T00:00:00Z'), correlationId: '00000000-0000-0000-0000-000000000000', causation: [], tags: []
    }
};
for (const [name, mutate] of boundaries) {
    for (const [historyName, history] of [['empty', []], ['seeded', [seeded]]] as const) {
        describe(`when rejecting context child keys: ${name}, ${historyName} history`, () => {
            it('should reject before replay with the model and contract path', () => {
                const compiled = fluent.compile();
                const definition = compiled.definitions[0];
                const schema: JsonSchema = JSON.parse(compiled.readModels[0].Schema);
                mutate({ compiled, definition, schema });
                compiled.readModels[0].Schema = JSON.stringify(schema);
                (() => new ProjectionReadModelProcessor(Model, compiled, definition).process(history))
                    .should.throw(UnsupportedProjectionOperation).and.satisfy((error: Error) =>
                        error.message.includes('Model') && /Children|From|Join|Schema|InitialModelState|Definition|All/.test(error.message));
            });
        });
    }
}
