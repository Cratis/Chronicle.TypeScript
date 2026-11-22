// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap } from '@cratis/chronicle.contracts';
import { chai, describe, it } from 'vitest';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../projections/declarative/projection.js';
import type { ChildrenDefinitionLike } from '../../../projections/modelBound/childrenAndNestedBuilder.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { ProjectionReadModelProcessor } from '../../projections/ProjectionReadModelProcessor.js';
import { ProjectionValueChildrenCapabilities } from '../../projections/ProjectionValueChildrenCapabilities.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';
import { Added, Model, artifacts, candidate } from './given/compiled_projection.js';

chai.should();
function input() {
    const compiled = candidate.compile();
    const definition = compiled.definitions[0];
    const children = definition.Children as unknown as Record<string, ChildrenDefinitionLike>;
    const child = children.values;
    const value = ProjectionValueChildrenCapabilities.definition(child)!;
    const event = compiled.eventSchemas.get(definition)!.get('ValueAdded:1:0')!.schema;
    return { compiled, definition, children, child, value, event };
}

function sourceExpression(state: ReturnType<typeof input>, expression: string): void {
    Object.assign(state.value, { PropertyExpression: expression });
    state.event.properties![expression] = { type: 'string' };
}

@projection('value-children-without-event', Model)
class ChildrenWithoutEvent {
    define(builder: IProjectionBuilderFor<Model>): void {
        builder.from(Added, () => {}).children(model => model.values,
            child => child.fromEventProperty<Added>(event => event.value));
    }
}

describe('when value children neighbor the proven plain-string shape', () => {
    it('should reject the separate children-builder API that emits no event identity', () => {
        (() => new ReadModelScenario(Model, { ...artifacts, projections: [ChildrenWithoutEvent] }))
            .should.throw(UnsupportedProjectionOperation, 'Children.values.FromEventProperty');
    });
    const cases: Array<{ name: string; mutate: (state: ReturnType<typeof input>) => void }> = [
        { name: 'missing event', mutate: ({ value }) => { delete (value as unknown as Record<string, unknown>).Event; } },
        { name: 'wrong generation', mutate: ({ value }) => { value.Event.Generation = 2; } },
        { name: 'tombstone event', mutate: ({ value }) => { value.Event.Tombstone = true; } },
        { name: 'unknown value fields', mutate: ({ value }) => { (value as unknown as Record<string, unknown>).Unknown = true; } },
        { name: 'nested source', mutate: ({ child }) => { (child as unknown as Record<string, unknown>).FromEventProperty = { Event: candidate.compile().definitions[0].From[1].Key, PropertyExpression: 'payload.value' }; } },
        { name: 'event-context source', mutate: ({ value }) => { (value as unknown as Record<string, unknown>).PropertyExpression = '$eventContext(Subject)'; } },
        { name: 'numeric source', mutate: ({ event }) => { event.properties!.value = { type: 'number', format: 'double' }; } },
        { name: 'formatted string source', mutate: ({ event }) => { event.properties!.value.format = 'guid'; } },
        { name: 'object source', mutate: ({ event }) => { event.properties!.value = { type: 'object' }; } },
        { name: 'nullable source', mutate: ({ event }) => { event.properties!.value.type = ['string', 'null']; } },
        { name: 'custom child identity', mutate: ({ child }) => { child.IdentifiedBy = 'value'; } },
        { name: 'ordinary child From', mutate: ({ child, definition }) => { child.From = [definition.From[1] as never]; } },
        { name: 'child removals', mutate: ({ child, definition }) => { child.RemovedWith = [definition.RemovedWith[0] as never]; } },
        { name: 'child join', mutate: ({ child }) => { child.Join = [{}]; } },
        { name: 'nested children', mutate: ({ child }) => { child.Children = { inner: child }; } },
        { name: 'child All mapping', mutate: ({ child }) => { child.All.Properties.value = 'value'; } },
        { name: 'child ordering', mutate: ({ child }) => { child.Ordering = {} as never; } },
        { name: 'disabled child AutoMap', mutate: ({ child }) => { child.AutoMap = AutoMap.Disabled; } },
        { name: 'shared child event', mutate: ({ children, child }) => { children.other = structuredClone(child); } },
        { name: 'explicit root mapping', mutate: ({ definition }) => { definition.From[1].Value!.Properties.name = 'value'; } },
        { name: 'root AutoMap overlap', mutate: ({ event }) => { event.properties!.name = { type: 'string' }; } },
        { name: 'missing root subscription', mutate: ({ definition }) => { definition.From = definition.From.slice(0, 1); } },
        { name: 'initial state', mutate: ({ definition }) => { definition.InitialModelState = '{"name":"initial"}'; } },
        { name: 'numeric target', mutate: ({ compiled }) => {
            const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
            schema.properties!.values.items = { type: 'number', format: 'double' };
            compiled.readModels[0].Schema = JSON.stringify(schema);
        } }
    ];
    // Pinned dfa5ea4: LiteralExpressionResolver.TryRead, NullExpressionResolver.CanResolve,
    // EventContentExpressionResolver.CanResolve, and Concepts/WellKnownExpressions.Null.
    const expressions = [
        'true', 'True', 'false', 'False', '"value"', '"unfinished',
        '0', '-1', '+1', '1.5', '.5', '1e2', '+1E-2',
        '$null', '$value(value)', '$eventSourceId', '$eventContext(Subject)', '$causedBy(name)', '$unknown', ''
    ];
    const literalCases = expressions.map(expression => ({
        name: `literal/provider expression ${JSON.stringify(expression)} despite a same-named string field`,
        mutate: (state: ReturnType<typeof input>) => sourceExpression(state, expression)
    }));
    for (const entry of [...cases, ...literalCases]) for (const seeded of [false, true]) {
        it(`should reject ${entry.name} before replay for ${seeded ? 'seeded' : 'empty'} history`, async () => {
            const state = input();
            entry.mutate(state);
            let caught: unknown;
            try {
                const processor = new ProjectionReadModelProcessor(Model, state.compiled, state.definition);
                await processor.process(seeded ? [null as never] : []);
            } catch (error) { caught = error; }
            (caught instanceof UnsupportedProjectionOperation).should.be.true;
            (caught as Error).message.should.match(/kernel-backed test|participating event schema is unavailable/);
        });
    }

    for (const expression of ['null', 'Null', 'NULL', 'TRUE', 'FALSE', 'tRuE', 'fAlSe', 'NaN', 'Infinity']) {
        it(`should retain the direct property ${expression}, which the pinned kernel does not classify as a literal`, () => {
            const state = input();
            sourceExpression(state, expression);
            (() => new ProjectionReadModelProcessor(Model, state.compiled, state.definition)).should.not.throw();
        });
    }

    for (const value of [null, undefined]) {
        it(`should reject a ${String(value)} seeded value rather than infer null/missing semantics`, async () => {
            const scenario = new ReadModelScenario(Model, artifacts);
            scenario.given.forEventSource('A').events(new Added(value as unknown as string));
            const error = await scenario.instanceForEventSourceId('A').catch(error => error);
            (error instanceof UnsupportedProjectionOperation).should.be.true;
            error.message.should.include('missing or null value children');
        });
    }
});
