// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { EventType } from '../../../events/EventType.js';
import { beforeEach, chai, describe, it } from 'vitest';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { compile, Totals } from '../../for_ReadModelScenario/when_counting_with_children/given/compiled_projection.js';
import type { ScenarioEvent } from '../../ScenarioEvent.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();

type Candidate = { compiled: ReturnType<typeof compile>; definition: ProjectionDefinition; schema: JsonSchema };
type Mutation = (candidate: Candidate) => void;
const boundaries: Array<[string, Mutation]> = [
    ...['$increment', '$decrement'].map(expression => [expression,
        ({ definition }: Candidate) => { definition.From[0].Value.Properties.total = expression; }] as [string, Mutation]),
    ['int32 count', ({ schema }) => { schema.properties!.total = { type: 'integer', format: 'int32' }; }],
    ['float count', ({ schema }) => { schema.properties!.total = { type: 'number', format: 'float' }; }],
    ['GUID root identifier', ({ schema }) => { schema.properties!.id.format = 'uuid'; }],
    ['numeric root identifier', ({ schema }) => { schema.properties!.id = { type: 'number' }; }],
    ['extra root property', ({ schema }) => { schema.properties!.name = { type: 'string' }; }],
    ['extra root mapping', ({ definition }) => { definition.From[0].Value.Properties.id = '$eventSourceId'; }],
    ['multiple root subscriptions', ({ definition }) => { definition.From.push(structuredClone(definition.From[0])); }],
    ['initial values', ({ definition }) => { definition.InitialModelState = '{"total":0}'; }],
    ['root join', ({ definition }) => { definition.Join.push({ Key: definition.From[0].Key, Value: { On: 'id', Properties: {}, Key: '$eventSourceId' } }); }],
    ['multiple child collections', ({ definition }) => { definition.Children.other = structuredClone(definition.Children.items); }],
    ['untyped children', ({ schema }) => { delete schema.properties!.items.items!.properties; }],
    ['numeric child property', ({ schema }) => { schema.properties!.items.items!.properties!.name = { type: 'number' }; }],
    ['formatted child property', ({ schema }) => { schema.properties!.items.items!.properties!.name.format = 'uuid'; }],
    ['numeric child identifier', ({ schema }) => { schema.properties!.items.items!.properties!.itemId = { type: 'number' }; }],
    ['missing child identifier', ({ schema }) => { delete schema.properties!.items.items!.properties!.itemId; }],
    ['child without From', ({ definition }) => { definition.Children.items.From = []; }],
    ['child From without event Key', ({ definition }) => { delete definition.Children.items.From[0].Key; }],
    ['child removal without event Key', ({ definition }) => { delete definition.Children.items.RemovedWith[0].Key; }],
    ['shared root and child From', ({ definition }) => { definition.Children.items.From[0].Key = definition.From[0].Key; }],
    ['shared root From and child removal', ({ definition }) => { definition.Children.items.RemovedWith[0].Key = definition.From[0].Key; }],
    ['shared root removal and child From', ({ definition }) => { definition.Children.items.From[0].Key = definition.RemovedWith[0].Key; }],
    ['shared root and child removal', ({ definition }) => { definition.Children.items.RemovedWith[0].Key = definition.RemovedWith[0].Key; }],
    ['custom root key', ({ definition }) => { definition.From[0].Value.Key = 'total'; }],
    ['custom child parent key', ({ definition }) => { definition.Children.items.From[0].Value.ParentKey = 'itemId'; }]
];

function candidate(): Candidate {
    const compiled = compile();
    return { compiled, definition: compiled.definitions[0], schema: JSON.parse(compiled.readModels[0].Schema) };
}

// A constructor failure must precede processing even when events are supplied.
const seeded: ScenarioEvent = {
    sourceId: 'A', content: { total: 9000 },
    context: {
        eventSourceId: 'A', eventType: EventType.parse('Counted+1'), sequenceNumber: 0n,
        occurred: new Date('2025-01-01T00:00:00Z'), correlationId: '00000000-0000-0000-0000-000000000000',
        causation: [], tags: []
    }
};
const histories: Array<[string, ScenarioEvent[]]> = [['empty', []], ['seeded', [seeded]]];
for (const [name, mutate] of boundaries) {
    for (const [historyName, history] of histories) {
        describe(`when rejecting count with children: ${name}, ${historyName} history`, () => {
            let act: () => Promise<unknown>;
            beforeEach(() => {
                const value = candidate();
                mutate(value);
                value.compiled.readModels[0].Schema = JSON.stringify(value.schema);
                act = () => new ProjectionReadModelProcessor(Totals, value.compiled, value.definition).process(history);
            });
            it('should reject before replay', () => act.should.throw(UnsupportedProjectionOperation));
        });
    }
}

for (const [operation, expected] of [['add', 18000], ['subtract', -18000]] as const) {
    describe(`when applying ${operation} to the unformatted same-name operand in the count boundary`, () => {
        it('should admit the fixture-backed arithmetic rather than count or assign', async () => {
            const value = candidate();
            value.definition.From[0].Value.Properties.total = `$${operation}(total)`;
            const processor = new ProjectionReadModelProcessor(Totals, value.compiled, value.definition);
            await processor.process([seeded, { ...seeded, context: { ...seeded.context, sequenceNumber: 1n } }]);
            processor.publicRead.A.total.should.equal(expected);
        });
    });
}

for (const format of [undefined, 'double']) {
    describe(`when admitting count with ${format ?? 'unformatted number'} and typed children`, () => {
        let act: () => ProjectionReadModelProcessor<Totals>;
        beforeEach(() => {
            const value = candidate();
            value.schema.properties!.total.format = format;
            value.compiled.readModels[0].Schema = JSON.stringify(value.schema);
            act = () => new ProjectionReadModelProcessor(Totals, value.compiled, value.definition);
        });
        it('should admit the empty-history constructor', () => act.should.not.throw());
    });
}
