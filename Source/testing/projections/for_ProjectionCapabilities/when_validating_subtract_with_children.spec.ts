// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { EventType } from '../../../events/EventType.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { compile, Totals } from '../../for_ReadModelScenario/when_subtracting_with_children/given/compiled_projection.js';
import type { ScenarioEvent } from '../../ScenarioEvent.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();
type Candidate = { compiled: ReturnType<typeof compile>; definition: ProjectionDefinition; schema: JsonSchema; operand: JsonSchema };
type Mutation = (candidate: Candidate) => void;
const boundaries: Array<[string, Mutation]> = [
    ...['$increment', '$decrement', '$subtract()', '$subtract(amount + 1)', '$subtract(nested.amount)', '$subtract($eventSourceId)',
        '$subtract(1)', '$subtract(true)', '$subtract(snake_case)', '$subtract(missing)', '$subtract(amount', '$subtract(_snake_case)'].map(expression =>
        [expression, ({ definition }: Candidate) => { definition.From[0].Value.Properties.total = expression; }] as [string, Mutation]),
    ...['int32', 'uint32', 'float', 'double', ''].flatMap(format => [
        [`${format || 'empty'} operand format`, ({ operand }: Candidate) => { operand.format = format; }],
        [`${format || 'empty'} target format`, ({ schema }: Candidate) => { schema.properties!.total.format = format; }]
    ] as Array<[string, Mutation]>),
    ['integer operand', ({ operand }) => { operand.type = 'integer'; operand.format = 'int32'; }],
    ['integer target', ({ schema }) => { schema.properties!.total = { type: 'integer', format: 'int32' }; }],
    ['non-numeric operand', ({ operand }) => { operand.type = 'string'; }],
    ['non-numeric target', ({ schema }) => { schema.properties!.total = { type: 'string' }; }],
    ['nullable operand', ({ operand }) => { Object.assign(operand, { type: ['number', 'null'] }); }],
    ['nullable target', ({ schema }) => { Object.assign(schema.properties!.total, { type: ['number', 'null'] }); }],
    ['protected operand', ({ operand }) => { operand.security = [{ metadataType: 'EncryptedSubject', details: '' }]; }],
    ['compliance operand', ({ operand }) => { operand.compliance = [{ metadataType: 'PII', details: '' }]; }],
    ['protected target', ({ schema }) => { schema.properties!.total.security = [{ metadataType: 'EncryptedSubject', details: '' }]; }],
    ['compliance target', ({ schema }) => { schema.properties!.total.compliance = [{ metadataType: 'PII', details: '' }]; }],
    ['GUID root identifier', ({ schema }) => { schema.properties!.id.format = 'uuid'; }],
    ['extra root property', ({ schema }) => { schema.properties!.name = { type: 'string' }; }],
    ['extra root mapping', ({ definition }) => { definition.From[0].Value.Properties.id = '$eventSourceId'; }],
    ['multiple root subscriptions', ({ definition }) => { definition.From.push(structuredClone(definition.From[0])); }],
    ...['add-first', 'subtract-first'].flatMap(order => [
        [`mixed add/subtract subscriptions, ${order}`, ({ definition }: Candidate) => {
            const added = structuredClone(definition.From[0]);
            added.Value.Properties.total = '$add(amount)';
            if (order === 'add-first') definition.From.unshift(added);
            else definition.From.push(added);
        }],
        [`mixed add/subtract targets, ${order}`, ({ definition, schema }: Candidate) => {
            schema.properties!.other = { type: 'number' };
            definition.From[0].Value.Properties = order === 'add-first'
                ? { other: '$add(amount)', total: '$subtract(amount)' }
                : { total: '$subtract(amount)', other: '$add(amount)' };
        }]
    ] as Array<[string, Mutation]>),
    ['initial values', ({ definition }) => { definition.InitialModelState = '{"total":0}'; }],
    ['root join', ({ definition }) => { definition.Join.push({ Key: definition.From[0].Key, Value: { On: 'id', Properties: {}, Key: '$eventSourceId' } }); }],
    ['multiple child collections', ({ definition }) => { definition.Children.other = structuredClone(definition.Children.items); }],
    ['untyped children', ({ schema }) => { delete schema.properties!.items.items!.properties; }],
    ['numeric child property', ({ schema }) => { schema.properties!.items.items!.properties!.name = { type: 'number' }; }],
    ['missing child identifier', ({ schema }) => { delete schema.properties!.items.items!.properties!.itemId; }],
    ['child From without event Key', ({ definition }) => { delete definition.Children.items.From[0].Key; }],
    ['child removal without event Key', ({ definition }) => { delete definition.Children.items.RemovedWith[0].Key; }],
    ['shared root and child From', ({ definition }) => { definition.Children.items.From[0].Key = definition.From[0].Key; }],
    ['shared root From and child removal', ({ definition }) => { definition.Children.items.RemovedWith[0].Key = definition.From[0].Key; }],
    ['shared root removal and child From', ({ definition }) => { definition.Children.items.From[0].Key = definition.RemovedWith[0].Key; }],
    ['shared root and child removal', ({ definition }) => { definition.Children.items.RemovedWith[0].Key = definition.RemovedWith[0].Key; }],
    ['shared root From and removal', ({ definition }) => { definition.RemovedWith[0].Key = definition.From[0].Key; }],
    ['custom root key', ({ definition }) => { definition.From[0].Value.Key = 'amount'; }],
    ['custom root parent key', ({ definition }) => { definition.From[0].Value.ParentKey = 'amount'; }],
    ['custom child parent key', ({ definition }) => { definition.Children.items.From[0].Value.ParentKey = 'itemId'; }],
    ['child join', ({ definition }) => { definition.Children.items.Join.push({}); }],
    ['nested children', ({ definition }) => { definition.Children.items.Children.nested = structuredClone(definition.Children.items); }],
    ['value children', ({ definition }) => { definition.Children.items.FromEventProperty = 'items'; }],
    ['unknown child expression', ({ definition }) => { definition.Children.items.From[0].Value.Properties.name = '$unknown(name)'; }],
    ['unknown root expression', ({ definition }) => { definition.From[0].Value.Properties.total = '$unknown(amount)'; }]
];

function candidate(): Candidate {
    const compiled = compile();
    const definition = compiled.definitions[0];
    const operand = [...compiled.eventSchemas.get(definition)!.values()].find(entry => entry.eventType.Id === 'Subtracted')!.schema.properties!.amount;
    return { compiled, definition, schema: JSON.parse(compiled.readModels[0].Schema), operand };
}
const seeded: ScenarioEvent = {
    sourceId: 'A', content: { amount: 2.5 },
    context: {
        eventSourceId: 'A', eventType: EventType.parse('Subtracted+1'), sequenceNumber: 0n,
        occurred: new Date('2025-01-01T00:00:00Z'), correlationId: '00000000-0000-0000-0000-000000000000',
        causation: [], tags: []
    }
};
for (const [name, mutate] of boundaries) {
    for (const [historyName, history] of [['empty', []], ['seeded', [seeded]]] as const) {
        describe(`when rejecting subtraction with children: ${name}, ${historyName} history`, () => {
            let act: () => Promise<unknown>;
            beforeEach(() => {
                const value = candidate();
                mutate(value);
                value.compiled.readModels[0].Schema = JSON.stringify(value.schema);
                act = () => new ProjectionReadModelProcessor(Totals, value.compiled, value.definition).process(history);
            });
            it('should reject before replay with the model and contract path', () => {
                act.should.throw(UnsupportedProjectionOperation).and.satisfy((error: Error) =>
                    error.message.includes('Totals') && /Children|From|Join|Schema|Definition/.test(error.message));
            });
        });
    }
}
