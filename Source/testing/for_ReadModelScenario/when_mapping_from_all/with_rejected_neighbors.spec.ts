// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import { describe, it, chai } from 'vitest';
import { ProjectionReadModelProcessor } from '../../projections/ProjectionReadModelProcessor.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';
import { candidate } from './given/compiled_projection.js';

chai.should();

describe('when an all-event mapping neighbors the proven root shape', () => {
    const cases: Array<{ name: string; mutate: (definition: ProjectionDefinition) => void }> = [
        { name: 'empty All', mutate: definition => { definition.All!.Properties = {}; } },
        { name: 'All AutoMap enabled', mutate: definition => { definition.All!.AutoMap = AutoMap.Enabled; } },
        { name: 'All AutoMap disabled', mutate: definition => { definition.All!.AutoMap = AutoMap.Disabled; } },
        { name: 'All excluding children', mutate: definition => { definition.All!.IncludeChildren = false; } },
        { name: 'payload assignment', mutate: definition => { definition.All!.Properties.lastSequence = 'name'; } },
        { name: 'other context', mutate: definition => { definition.All!.Properties.lastSequence = '$eventContext(Subject)'; } },
        { name: 'arithmetic', mutate: definition => { definition.All!.Properties.lastSequence = '$count'; } },
        { name: 'dynamic destination', mutate: definition => { definition.All!.Properties = { 'lastSequence.$eventContext.eventType.id': '$eventContext(SequenceNumber)' }; } },
        { name: 'overlapping destination', mutate: definition => { definition.All!.Properties = { name: '$eventContext(SequenceNumber)' }; } },
        { name: 'multiple All mappings', mutate: definition => { definition.All!.Properties.name = '$eventContext(SequenceNumber)'; } },
        { name: 'no ordinary mappings', mutate: definition => { definition.From = []; } },
        { name: 'custom key', mutate: definition => { definition.From[0].Value!.Key = '$value(custom)'; } },
        { name: 'initial state', mutate: definition => { definition.InitialModelState = '{"name":"initial"}'; } },
        { name: 'root AutoMap disabled', mutate: definition => { definition.AutoMap = AutoMap.Disabled; } },
        { name: 'root exclusions', mutate: definition => { definition.NoAutoMapProperties = ['name']; } },
        { name: 'child operations', mutate: definition => { definition.Children = { items: { IdentifiedBy: 'id', From: [], Join: [], Children: {}, RemovedWith: [] } } as unknown as ProjectionDefinition['Children']; } },
        { name: 'join operations', mutate: definition => { definition.Join = [{ Key: { Id: 'Other', Generation: 1 }, Value: { On: 'name', Key: '$eventSourceId', Properties: { name: 'name' } } }] as unknown as ProjectionDefinition['Join']; } },
        { name: 'derivatives', mutate: definition => { definition.FromEvery = [{ Id: 'Other', Generation: 1 }]; } },
        { name: 'nested projections', mutate: definition => { definition.Nested = { other: {} } as ProjectionDefinition['Nested']; } }
    ];
    for (const entry of cases) for (const seeded of [false, true]) {
        it(`should reject ${entry.name} before replay for ${seeded ? 'seeded' : 'empty'} history`, async () => {
            const compiled = candidate.compile();
            const definition = compiled.definitions[0];
            entry.mutate(definition);
            let caught: unknown;
            try {
                const processor = new ProjectionReadModelProcessor(candidate.model, compiled, definition);
                await processor.process(seeded ? [null as never] : []);
            } catch (error) { caught = error; }
            (caught instanceof UnsupportedProjectionOperation).should.be.true;
            (caught as Error).message.should.include('kernel-backed test');
        });
    }
});
