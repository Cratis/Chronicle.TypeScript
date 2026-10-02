// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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

@eventType('legacy-projection-tags-renamed')
class Renamed {
    name = 'updated';
}
function createArtifacts(modelBound: boolean, values: string[] = []) {
    @tag(...(modelBound ? values : ['read-model-only']))
    class Model {
        static readonly readModelId = 'legacy-projection-tags-model';
        id = '';
        name = '';
    }
    @projection('legacy-projection-tags-projection', Model)
    @tag(...(modelBound ? [] : values))
    class ModelProjection {
        define(builder: IProjectionBuilderFor<Model>): void {
            builder.from(Renamed);
        }
    }
    if (modelBound) fromEvent(Renamed)(Model);
    const observer = modelBound ? Model : ModelProjection;
    const artifacts: IClientArtifactsProvider = {
        eventTypes: [Renamed], readModels: [Model], projections: modelBound ? [] : [ModelProjection],
        reducers: [], reactors: [], globalForHandlers: [], seeders: [], constraints: [], webhooks: [], eventTypeMigrations: []
    };
    const compile = () => new ProjectionDefinitionCompiler(artifacts, 'test-sink')
        .compile(artifacts.projections, modelBound ? [Model] : []).definitions[0];
    return { artifacts, observer, Model, compile };
}

for (const modelBound of [false, true]) {
    describe(`when compiling tags on a legacy ${modelBound ? 'model-bound read model' : 'declarative projection class'}`, () => {
        it('should send accumulated distinct observer labels to the kernel in stable order', async () => {
            const { artifacts, observer } = createArtifacts(modelBound, ['reporting', 'analytics']);
            tags('reporting', 'audit')(observer);
            tag('analytics')(observer);
            const register = vi.fn().mockResolvedValue({});
            const connection = { projections: { register }, readModels: { registerMany: vi.fn().mockResolvedValue({}) } } as unknown as ChronicleConnection;
            await new Projections('store', 'namespace', connection, artifacts, 'test-sink').register();
            const request = register.mock.calls[0][0] as { Projections: { Tags: string[] }[] };
            request.Projections[0].Tags.should.deep.equal(['analytics', 'audit', 'reporting']);
        });

        it('should keep an untagged observer empty without borrowing declarative read-model labels', () => {
            createArtifacts(modelBound).compile().Tags.should.deep.equal([]);
        });

        it('should hash the same tag set identically regardless of declaration order and duplicates', () => {
            const first = createArtifacts(modelBound, ['reporting', 'analytics']);
            tags('reporting')(first.observer);
            const second = createArtifacts(modelBound, ['analytics', 'reporting', 'analytics']);
            first.compile().LastUpdated!.Value.should.equal(second.compile().LastUpdated!.Value);
            first.compile().LastUpdated!.Value.should.equal(first.compile().LastUpdated!.Value);
        });

        it('should include tag changes in the definition hash without reordering metadata', () => {
            const { compile, observer } = createArtifacts(modelBound, ['reporting', 'analytics']);
            const previous = compile().LastUpdated!.Value;
            getTagsFor(observer).map(value => value.value).should.deep.equal(['reporting', 'analytics']);
            tag('audit')(observer);
            compile().LastUpdated!.Value.should.not.equal(previous);
        });

        it('should not filter untagged events in the in-process read-model scenario', async () => {
            const { Model, artifacts } = createArtifacts(modelBound, ['analytics']);
            const scenario = new ReadModelScenario(Model, artifacts);
            scenario.given.forEventSource('source').events(new Renamed());
            (await scenario.instance)!.name.should.equal('updated');
        });
    });
}
