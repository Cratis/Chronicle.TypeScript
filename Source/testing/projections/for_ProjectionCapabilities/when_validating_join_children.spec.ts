// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { describe, expect, it } from 'vitest';
import type { ChildrenDefinitionLike } from '../../../projections/modelBound/childrenAndNestedBuilder.js';
import type { FromRecord } from '../../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { fluent, Model, Placed, ItemChanged, ItemRemoved, Removed } from '../../for_ReadModelScenario/when_joining_with_children/given/compiled_projection.js';
import type { ProjectionJoinRecord } from '../ProjectionJoinRecord.js';
import { ProjectionReadModelProcessor } from '../ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

type Input = { definition: ProjectionDefinition; schema: JsonSchema; child: ChildrenDefinitionLike; join: ProjectionJoinRecord; from: FromRecord };
function rejectMutation(mutate: (input: Input) => void) {
    const compiled = fluent.compile();
    const definition = compiled.definitions[0];
    const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
    const child = definition.Children.items as ChildrenDefinitionLike;
    const join = definition.Join[0] as ProjectionJoinRecord;
    const from = definition.From[0] as FromRecord;
    mutate({ definition, schema, child, join, from });
    compiled.readModels[0].Schema = JSON.stringify(schema);
    expect(() => new ProjectionReadModelProcessor(Model, compiled, definition)).toThrow(UnsupportedProjectionOperation);
}

describe('when validating the measured root join and independent children intersection', () => {
    it('should admit the compiler-produced shape before replay', () => {
        const compiled = fluent.compile();
        expect(() => new ProjectionReadModelProcessor(Model, compiled, compiled.definitions[0])).not.toThrow();
    });
    const unsupported: Array<[string, (input: Input) => void]> = [
        ['another collection', ({ definition }) => { definition.Children.more = structuredClone(definition.Children.items); }],
        ['another root subscription', ({ definition }) => { definition.From.push(structuredClone(definition.From[0])); }],
        ['another join', ({ definition }) => { definition.Join.push(structuredClone(definition.Join[0])); }],
        ['a child join', ({ child, join }) => { child.Join.push(structuredClone(join)); }],
        ['a nested child', ({ child }) => { child.Children.nested = structuredClone(child); }],
        ['a child property mapping', ({ child }) => { child.From[0].Value.Properties.name = 'name'; }],
        ['a numeric child schema', ({ schema }) => { schema.properties!.items.items!.properties!.name.type = 'integer'; }],
        ['a missing typed collection', ({ schema }) => { delete schema.properties!.items.items; }],
        ['a formatted child identifier', ({ schema }) => { schema.properties!.items.items!.properties!.itemId.format = 'uuid'; }],
        ['a different child key', ({ child }) => { child.From[0].Value.Key = 'name'; }],
        ['a context child key', ({ child }) => { child.From[0].Value.Key = '$eventContext.correlationId'; }],
        ['a different parent key', ({ child }) => { child.From[0].Value.ParentKey = 'parentId'; }],
        ['a root event shared with children', ({ child, from }) => { child.From[0].Key.Id = from.Key.Id; }],
        ['a join event shared with children', ({ child, join }) => { child.From[0].Key.Id = join.Key.Id; }],
        ['a root removal shared with children', ({ child, definition }) => { child.RemovedWith[0].Key.Id = definition.RemovedWith[0].Key!.Id; }],
        ['disabled child automapping', ({ child }) => { child.AutoMap = AutoMap.Disabled; }],
        ['a child automapping exclusion', ({ child }) => { child.NoAutoMapProperties = ['name']; }],
        ['a root automapping exclusion', ({ definition }) => { definition.NoAutoMapProperties = ['customerId']; }],
        ['arithmetic on the join target', ({ from }) => { from.Value.Properties.customerId = '$add(customerId)'; }],
        ['initial state', ({ definition }) => { definition.InitialModelState = '{"customerName":"initial"}'; }],
        ['a custom root key', ({ from }) => { from.Value.Key = 'customerId'; }],
        ['a non-string root member', ({ schema }) => { schema.properties!.customerId.type = 'integer'; }],
        ['an overlapping root destination', ({ from }) => { from.Value.Properties.customerName = 'customerId'; }],
        ['an overlapping join target', ({ join }) => { join.Value.Properties = { customerId: 'name' }; }]
    ];
    for (const [name, mutate] of unsupported) {
        it(`should reject ${name} before replay`, () => rejectMutation(mutate));
    }
    for (const event of [new ItemChanged('one', 'early'), new ItemRemoved('one')]) {
        it(`should reject ${event.constructor.name} before a root From event`, async () => {
            const scenario = new ReadModelScenario(Model, fluent.artifacts);
            scenario.given.forEventSource('A').events(event);
            await expect(scenario.instanceForEventSourceId('A')).rejects.toThrow(/require a root From event before each child event/);
        });
        it(`should reject ${event.constructor.name} after root removal until recreation`, async () => {
            const scenario = new ReadModelScenario(Model, fluent.artifacts);
            scenario.given.forEventSource('A').events(new Placed('customer'), new Removed(), event);
            await expect(scenario.instanceForEventSourceId('A')).rejects.toThrow(/require a root From event before each child event/);
        });
    }
});
