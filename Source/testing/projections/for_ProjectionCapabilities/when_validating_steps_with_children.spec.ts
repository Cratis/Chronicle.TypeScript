// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { beforeEach, chai, describe, it } from 'vitest';
import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import { EventType } from '../../../events/EventType.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { variants, Totals } from '../../for_ReadModelScenario/when_stepping_with_children/given/compiled_projection.js';
import type { ScenarioEvent } from '../../ScenarioEvent.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();
type Candidate = { compiled: ReturnType<typeof variants[number]['compile']>; definition: ProjectionDefinition; schema: JsonSchema };
type Mutation = (candidate: Candidate) => void;
const boundaries: Array<[string, Mutation]> = [
    ...['$increment()', '$increment(total)', '$increment + 1', '$incremented', '$decrement()', '$decrement(total)',
        '$decrement + 1', '$decremented'].map(expression =>
        [expression, ({ definition }: Candidate) => { definition.From[0].Value.Properties.total = expression; }] as [string, Mutation]),
    ...['int32', 'uint32', 'float', 'double', ''].map(format =>
        [`${format || 'empty'} target format`, ({ schema }: Candidate) => { schema.properties!.total.format = format; }] as [string, Mutation]),
    ['integer target', ({ schema }) => { schema.properties!.total = { type: 'integer', format: 'int32' }; }],
    ['non-numeric target', ({ schema }) => { schema.properties!.total = { type: 'string' }; }],
    ['nullable target', ({ schema }) => { Object.assign(schema.properties!.total, { type: ['number', 'null'] }); }],
    ['protected target', ({ schema }) => { schema.properties!.total.security = [{ metadataType: 'EncryptedSubject', details: '' }]; }],
    ['compliance target', ({ schema }) => { schema.properties!.total.compliance = [{ metadataType: 'PII', details: '' }]; }],
    ['GUID root identifier', ({ schema }) => { schema.properties!.id.format = 'uuid'; }],
    ['extra root property', ({ schema }) => { schema.properties!.name = { type: 'string' }; }],
    ['extra root mapping', ({ definition }) => { definition.From[0].Value.Properties.id = '$eventSourceId'; }],
    ['multiple root subscriptions', ({ definition }) => { definition.From.push(structuredClone(definition.From[0])); }],
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
    ['custom root key', ({ definition }) => { definition.From[0].Value.Key = 'total'; }],
    ['custom root parent key', ({ definition }) => { definition.From[0].Value.ParentKey = 'total'; }],
    ['custom child parent key', ({ definition }) => { definition.Children.items.From[0].Value.ParentKey = 'itemId'; }],
    ['child join', ({ definition }) => { definition.Children.items.Join.push({}); }],
    ['nested children', ({ definition }) => { definition.Children.items.Children.nested = structuredClone(definition.Children.items); }],
    ['value children', ({ definition }) => { definition.Children.items.FromEventProperty = 'items'; }],
    ['unknown child expression', ({ definition }) => { definition.Children.items.From[0].Value.Properties.name = '$unknown(name)'; }],
    ['unknown root expression', ({ definition }) => { definition.From[0].Value.Properties.total = '$unknown(total)'; }]
];

function mixtures(expression: string): Array<[string, Mutation]> {
    return ['$increment', '$decrement', '$add(total)', '$subtract(total)', '$count'].filter(other => other !== expression)
        .flatMap(other => [false, true].flatMap(otherFirst => [
            [`${expression}/${other} same target, other first=${otherFirst}`, ({ definition }: Candidate) => {
                const second = structuredClone(definition.From[0]);
                second.Value.Properties.total = other;
                if (otherFirst) definition.From.unshift(second);
                else definition.From.push(second);
            }],
            [`${expression}/${other} different targets, other first=${otherFirst}`, ({ definition, schema }: Candidate) => {
                schema.properties!.other = { type: 'number' };
                definition.From[0].Value.Properties = otherFirst ? { other, total: expression } : { total: expression, other };
            }]
        ] as Array<[string, Mutation]>));
}
function candidate(variant: typeof variants[number]): Candidate {
    const compiled = variant.compile();
    return { compiled, definition: compiled.definitions[0], schema: JSON.parse(compiled.readModels[0].Schema) };
}
const seeded: ScenarioEvent = {
    sourceId: 'A', content: { total: 2.5 },
    context: {
        eventSourceId: 'A', eventType: EventType.parse('Stepped+1'), sequenceNumber: 0n,
        occurred: new Date('2025-01-01T00:00:00Z'), correlationId: '00000000-0000-0000-0000-000000000000',
        causation: [], tags: []
    }
};
for (const variant of variants) {
    for (const [name, mutate] of [...boundaries, ...mixtures(`$${variant.operation}`)]) {
        for (const [historyName, history] of [['empty', []], ['seeded', [seeded]]] as const) {
            describe(`when rejecting ${variant.operation} with children: ${name}, ${historyName} history`, () => {
                let act: () => Promise<unknown>;
                beforeEach(() => {
                    const value = candidate(variant);
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
}
