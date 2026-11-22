// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { JsonSerializer } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { getEventTypeMetadata } from '../../../events/eventTypeDecorator.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { artifacts, Totals, variants } from './given/compiled_projection.js';
import { history, lifecycle } from './given/lifecycle.js';

chai.should();
describe('when adding with independent children through a fluent projection', () => {
    for (const variant of variants) {
        it(`should compile exactly the oracle input for ${variant.name}`, () => {
            const fixture = JSON.parse(readFileSync(new URL(`../../projections/fixtures/${variant.name}.json`, import.meta.url), 'utf8'));
            const compiled = variant.compile();
            const { LastUpdated, ...wire } = compiled.definitions[0];
            LastUpdated!.should.deep.equal(fixture.compilerLastUpdated);
            JSON.parse(JSON.stringify({ ...wire, NoAutoMapProperties: [] })).should.deep.equal(fixture.wireDefinition);
            JSON.parse(compiled.readModels[0].Schema).should.deep.equal(fixture.readModel.schema);
            const schemas = [...compiled.eventSchemas.get(compiled.definitions[0])!.values()].map(entry => {
                entry.eventType.Tombstone.should.be.false;
                const { Tombstone: _falseFlag, ...eventType } = entry.eventType;
                return { ...entry, eventType };
            });
            schemas.should.deep.equal(fixture.eventSchemas);
            const events = history(amount => new variant.event(amount));
            events.length.should.equal(fixture.events.length);
            events.forEach(({ source, event }, index) => {
                const captured = fixture.events[index];
                const type = getEventTypeMetadata(event.constructor)!.eventType;
                captured.context.eventType.should.deep.equal({ Id: type.id.value, Generation: type.generation.value });
                captured.context.eventSourceId.should.equal(source);
                captured.content.should.deep.equal(JSON.parse(JsonSerializer.serialize(event)));
            });
        });
    }

    it('should accumulate fractions, negative and zero values independently of child updates and removals', async () => {
        const result = await lifecycle(new ReadModelScenario(Totals, artifacts));
        result.first.total.should.equal(1.5);
        result.first.items.should.deep.equal([{ itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }]);
        result.remaining.total.should.equal(1.5);
        result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]);
        (result.removed === null).should.be.true;
        result.surviving.should.deep.equal(result.other);
        result.other.total.should.equal(8);
        result.recreated.total.should.equal(4.5);
        result.recreated.items.should.deep.equal([{ itemId: 'new', name: 'recreated' }]);
        result.repeated.should.deep.equal(result.recreated);
    });

    for (const variant of variants.slice(1)) {
        it(`should add rather than assign for ${variant.name}`, async () => {
            const scenario = new ReadModelScenario(Totals, variant.artifacts);
            for (const { source, event } of history(amount => new variant.event(amount)).slice(0, 8)) {
                scenario.given.forEventSource(source).events(event);
            }
            (await scenario.instanceForEventSourceId('A'))!.total.should.equal(1.5);
            (await scenario.instanceForEventSourceId('B'))!.total.should.equal(8);
        });
    }
});
