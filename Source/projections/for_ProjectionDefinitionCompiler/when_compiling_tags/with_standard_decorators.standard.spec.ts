// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it, vi } from 'vitest';
import type { IClientArtifactsProvider } from '../../../artifacts/index.js';
import type { ChronicleConnection } from '../../../connection/index.js';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { getTagsFor, tag, tags } from '../../../events/tagDecorator.js';
import { ReadModelScenario } from '../../../testing/ReadModelScenario.js';
import type { IProjectionBuilderFor } from '../../declarative/IProjectionBuilderFor.js';
import { projection } from '../../declarative/projection.js';
import { fromEvent } from '../../modelBound/fromEvent.js';
import { ProjectionDefinitionCompiler } from '../../ProjectionDefinitionCompiler.js';
import { Projections } from '../../Projections.js';

chai.should();

@eventType('standard-projection-tags-renamed')
class Renamed {
    @field(String) name = 'updated';
}

@tag('read-model-only')
class DeclarativeModel {
    @field(String) id = '';
    @field(String) name = '';
}

@projection('standard-projection-tags-projection', DeclarativeModel)
@tag('analytics', 'reporting')
@tags('reporting', 'audit')
class ModelProjection {
    define(builder: IProjectionBuilderFor<DeclarativeModel>): void {
        builder.from(Renamed);
    }
}

@fromEvent(Renamed)
@tags('analytics', 'reporting')
@tag('reporting', 'audit')
class ModelBound {
    @field(String) id = '';
    @field(String) name = '';
}

for (const modelBound of [false, true]) {
    describe(`when compiling tags on a standard ${modelBound ? 'model-bound read model' : 'declarative projection class'}`, () => {
        const model = modelBound ? ModelBound : DeclarativeModel;
        const observer = modelBound ? ModelBound : ModelProjection;
        const artifacts: IClientArtifactsProvider = {
            eventTypes: [Renamed], readModels: [model], projections: modelBound ? [] : [ModelProjection],
            reactors: [], reducers: [], globalForHandlers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
        };
        const compile = () => new ProjectionDefinitionCompiler(artifacts, 'test-sink')
            .compile(artifacts.projections, modelBound ? [ModelBound] : []).definitions[0];

        it('should register sorted distinct tags using both class decorator spellings', async () => {
            const register = vi.fn().mockResolvedValue({});
            const connection = { projections: { register }, readModels: { registerMany: vi.fn().mockResolvedValue({}) } } as unknown as ChronicleConnection;
            await new Projections('store', 'namespace', connection, artifacts, 'test-sink').register();
            const request = register.mock.calls[0][0] as { Projections: { Tags: string[] }[] };
            request.Projections[0].Tags.should.deep.equal(['analytics', 'audit', 'reporting']);
        });

        it('should retain a deterministic hash and leave decorator metadata untouched', () => {
            compile().LastUpdated!.Value.should.equal(compile().LastUpdated!.Value);
            getTagsFor(observer).map(value => value.value).should.deep.equal(['reporting', 'audit', 'analytics']);
        });

        it('should still evaluate untagged events through the shared compiler', async () => {
            const scenario = new ReadModelScenario(model, artifacts);
            scenario.given.forEventSource('source').events(new Renamed());
            (await scenario.instance)!.name.should.equal('updated');
        });
    });
}
