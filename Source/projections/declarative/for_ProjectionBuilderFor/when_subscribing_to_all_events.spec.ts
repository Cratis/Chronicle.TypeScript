// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { beforeEach, chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import { ProjectionBuilderFor, projection, type IFromAllBuilder, type IProjectionBuilderFor } from '../index.js';
import { ReadModelScenario } from '../../../testing/ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../../testing/projections/UnsupportedProjectionOperation.js';

chai.should();

class Model {
    title = '';
    source = '';
    lastSequence = '';
    counted = 0;
    incremented = 0;
    decremented = 0;
    countsByType: Record<string, number> = {};
}
class Declared { title = ''; }
class Removed {}
eventType('Declared')(Declared);
eventType('Removed')(Removed);

function mappings(all: IFromAllBuilder<Model>): void {
    all.set(model => model.title).to(model => model.title)
        .set(model => model.source).toEventSourceId()
        .set(model => model.lastSequence).toEventContextProperty('sequenceNumber')
        .count(model => model.counted)
        .increment(model => model.incremented)
        .decrement(model => model.decremented)
        .count(model => model.countsByType, 'eventType.id');
}

function fixture(name: string) {
    return JSON.parse(readFileSync(new URL(`../../../testing/projections/fixtures/${name}.json`, import.meta.url), 'utf8')) as {
        wireDefinition: { All: object; SubscribesToAllEvents: boolean };
        expected: Array<{ publicRead: Record<string, Record<string, unknown>> }>;
    };
}

for (const name of ['from-all-only', 'from-all-mixed', 'from-all-exclude-children', 'from-all-empty']) {
    describe(`when subscribing to all events using ${name}`, () => {
        let definition: Record<string, unknown>;
        const captured = fixture(name);
        beforeEach(() => {
            const builder = new ProjectionBuilderFor<Model>().noAutoMap();
            if (name === 'from-all-mixed' || name === 'from-all-exclude-children') {
                builder.from(Declared, from => from.set(model => model.title).toValue('explicit')).removedWith(Removed);
            }
            builder.fromAll(name === 'from-all-empty' ? () => {} : mappings);
            if (name === 'from-all-exclude-children') builder.fromEvery(every => every.excludeChildProjections());
            definition = builder.build(name, 'OracleReadModel');
        });
        it('should emit the all-events subscription captured by the packaged kernel', () => {
            definition.SubscribesToAllEvents!.should.equal(captured.wireDefinition.SubscribesToAllEvents);
        });
        it('should emit the mappings and child flag captured by the packaged kernel', () => {
            definition.All!.should.deep.equal(captured.wireDefinition.All);
        });
        it('should have kernel evidence that an undeclared event creates a read model', () => {
            captured.expected[0].publicRead['record-a'].id!.should.equal('record-a');
        });
    });
}

describe('when creating a declarative all-event scenario', () => {
    it('should reject an empty all-event subscription before any events can be seeded', () => {
        class AllProjection {
            define(builder: IProjectionBuilderFor<Model>): void { builder.fromAll(() => {}); }
        }
        projection('all-scenario', Model)(AllProjection);
        (() => new ReadModelScenario(Model, { readModels: [Model], eventTypes: [], projections: [AllProjection], reducers: [] }))
            .should.throw(UnsupportedProjectionOperation, 'SubscribesToAllEvents (.fromAll)');
    });
});

describe('when combining fromAll and fromEvery mappings', () => {
    it('should retain every mapping and never narrow the subscription', () => {
        const builder = new ProjectionBuilderFor<Model>();
        builder.fromEvery(every => every.set(model => model.title).to(model => model.title));
        builder.fromAll(all => all.count(model => model.counted));
        builder.fromAll(all => all.increment(model => model.incremented, 'eventType.id').decrement(model => model.decremented, 'eventType.id'));
        builder.fromEvery(every => every.set(model => model.source).toEventSourceId().excludeChildProjections());
        const definition = builder.build('mixed', 'Model');
        definition.SubscribesToAllEvents!.should.equal(true);
        definition.All!.should.deep.equal({ Properties: {
            title: 'title', counted: '$count', 'incremented.$eventContext.eventType.id': '$increment',
            'decremented.$eventContext.eventType.id': '$decrement', source: '$eventSourceId'
        }, IncludeChildren: false, AutoMap: 0 });
    });

    it('should leave fromEvery subscription behavior unchanged', () => {
        const builder = new ProjectionBuilderFor<Model>();
        builder.from(Declared).fromEvery(every => every.set(model => model.title).to(model => model.title));
        (builder.build('every', 'Model').SubscribesToAllEvents === undefined).should.be.true;
        const captured = fixture('from-every-restricted');
        captured.expected[0].publicRead.should.deep.equal({});
        captured.expected[3].publicRead['record-a'].counted!.should.equal(1);
        captured.expected[5].publicRead.should.deep.equal({});
    });

    it('should hash the subscription flag independently of identical mappings', () => {
        const all = new ProjectionBuilderFor<Model>().fromAll(builder => builder.set(model => model.title).to(model => model.title));
        const every = new ProjectionBuilderFor<Model>().fromEvery(builder => builder.set(model => model.title).to(model => model.title));
        all.build('same', 'Model').LastUpdated!.should.not.deep.equal(every.build('same', 'Model').LastUpdated);
        all.build('same', 'Model').LastUpdated!.should.deep.equal(all.build('same', 'Model').LastUpdated);
    });
});
