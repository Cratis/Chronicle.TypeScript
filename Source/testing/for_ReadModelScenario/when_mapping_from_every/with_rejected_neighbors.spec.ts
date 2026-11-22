// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { chai, describe, it, type Assertion } from 'vitest';
import { ProjectionReadModelProcessor } from '../../projections/ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';
import { candidate } from './given/compiled_projection.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

describe('when rejecting neighbors of the bounded fromEvery root mapping before seeding', () => {
    const cases: Array<{ name: string; mutate: (definition: ProjectionDefinition) => void; path: string }> = [
        { name: 'all-event subscription', mutate: definition => { definition.SubscribesToAllEvents = true; }, path: 'SubscribesToAllEvents' },
        { name: 'All AutoMap enabled', mutate: definition => { definition.All!.AutoMap = AutoMap.Enabled; }, path: 'All' },
        { name: 'All AutoMap disabled', mutate: definition => { definition.All!.AutoMap = AutoMap.Disabled; }, path: 'All' },
        { name: 'root AutoMap disabled', mutate: definition => { definition.AutoMap = AutoMap.Disabled; }, path: 'All' },
        { name: 'direct event property', mutate: definition => { definition.All!.Properties = { lastSequence: 'name' }; }, path: 'All' },
        { name: 'different context path', mutate: definition => { definition.All!.Properties = { lastSequence: '$eventContext(SequenceNumber.Value)' }; }, path: 'All' },
        { name: 'set-once mapping', mutate: definition => { definition.All!.Properties = { lastSequence: '$setOnce($eventContext(SequenceNumber))' }; }, path: 'All' },
        { name: 'arithmetic mapping', mutate: definition => { definition.All!.Properties = { 'lastSequence.$eventContext.SequenceNumber': '$increment' }; }, path: 'All' },
        { name: 'identifier mapping', mutate: definition => { definition.All!.Properties = { id: '$eventContext(SequenceNumber)' }; }, path: 'All' },
        { name: 'ordinary mapping collision', mutate: definition => { definition.All!.Properties = { name: '$eventContext(SequenceNumber)' }; }, path: 'All' },
        { name: 'multiple context mappings', mutate: definition => { definition.All!.Properties.name = '$eventSourceId'; }, path: 'All' },
        { name: 'initial state', mutate: definition => { definition.InitialModelState = '{"name":"seed"}'; }, path: 'All' },
        { name: 'children', mutate: definition => { definition.Children = { details: {} } as unknown as typeof definition.Children; }, path: 'All' },
        { name: 'joins', mutate: definition => { definition.Join = [{}] as typeof definition.Join; }, path: 'All' },
        { name: 'nested projection', mutate: definition => { definition.Nested = { details: {} } as unknown as typeof definition.Nested; }, path: 'Nested.details' },
        { name: 'no ordinary subscriptions', mutate: definition => { definition.From = []; }, path: 'All' },
        { name: 'derivatives', mutate: definition => { definition.FromEvery = [{}] as typeof definition.FromEvery; }, path: 'FromEvery' }
    ];
    for (const testCase of cases) it(`should reject ${testCase.name} with the read model and path`, () => {
        const compiled = candidate.compile();
        const definition = compiled.definitions[0];
        testCase.mutate(definition);
        should(() => new ProjectionReadModelProcessor(candidate.model, compiled, definition)).throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('Model').and.includes(testCase.path);
    });

    it('should reject a potential AutoMap collision in a handled event schema', () => {
        const compiled = candidate.compile();
        const definition = compiled.definitions[0];
        const schema = [...compiled.eventSchemas.get(definition)!.values()][0].schema;
        schema.properties!.lastSequence = { type: 'string' };
        should(() => new ProjectionReadModelProcessor(candidate.model, compiled, definition)).throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('All (.fromEvery)');
    });
});
