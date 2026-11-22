// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { beforeAll, chai, describe, it } from 'vitest';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../projections/declarative/projection.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { artifacts, compile, Counted, Item, ItemChanged, ItemRemoved, Removed, Totals } from './given/compiled_projection.js';
import { lifecycle } from './given/lifecycle.js';

chai.should();

class MappedProjection {
    define(builder: IProjectionBuilderFor<Totals>): void {
        builder.from(Counted)
            .children<Item>(model => model.items, child => child.identifiedBy(item => item.itemId)
                .from(ItemChanged, from => from.usingKey(event => event.itemId))
                .removedWith(ItemRemoved, removal => removal.usingKey(event => event.itemId)))
            .removedWith(Removed);
    }
}
projection('mapped-children', Totals)(MappedProjection);

describe('when compiling a root count with typed children', () => {
    let wire: ReturnType<typeof compile>['definitions'][number];
    let schema: JsonSchema;
    beforeAll(() => {
        const compiled = compile();
        wire = compiled.definitions[0];
        schema = JSON.parse(compiled.readModels[0].Schema);
    });
    for (const name of ['count-children-root-first.json', 'count-children-child-first.json']) {
        it(`should match the real compiler wire and schemas in ${name}`, () => {
            const fixture = JSON.parse(readFileSync(new URL(`../../projections/fixtures/${name}`, import.meta.url), 'utf8'));
            const compiled = compile();
            const definition = compiled.definitions[0];
            // Only the oracle input omits registration metadata; client output retains it.
            const { LastUpdated, ...emittedFields } = JSON.parse(JSON.stringify(definition));
            LastUpdated.should.deep.equal(fixture.compilerLastUpdated);
            Object.hasOwn(fixture.wireDefinition, 'LastUpdated').should.be.false;
            const oracleFields = Object.hasOwn(emittedFields, 'NoAutoMapProperties')
                ? emittedFields : { ...emittedFields, NoAutoMapProperties: [] };
            oracleFields.should.deep.equal(fixture.wireDefinition);
            definition.LastUpdated!.should.deep.equal(fixture.compilerLastUpdated);
            JSON.parse(compiled.readModels[0].Schema).should.deep.equal(fixture.readModel.schema);
            const emittedSchemas = [...compiled.eventSchemas.get(definition)!.values()];
            const oracleSchemas = emittedSchemas.map(({ eventType, ...fields }) => {
                // The kernel EventType constructor defaults only a false tombstone flag.
                const { Tombstone, ...header } = eventType;
                Tombstone.should.be.false;
                return { ...fields, eventType: header };
            });
            oracleSchemas.should.deep.equal(fixture.eventSchemas);
            emittedSchemas.every(entry => Object.hasOwn(entry.eventType, 'Tombstone') && entry.eventType.Tombstone === false).should.be.true;
        });
    }

    it('should admit count with children through the ordinary public constructor', () => {
        (() => new ReadModelScenario(Totals, artifacts)).should.not.throw();
    });

    it('should preserve the existing non-arithmetic child-before-parent placeholder path', async () => {
        const ordinary = new ReadModelScenario(Totals, { ...artifacts, projections: [MappedProjection] });
        ordinary.given.forEventSource('A').events(new ItemChanged('one', 'first'), new ItemChanged('one', 'updated'));
        (await ordinary.instance)!.items.should.deep.equal([{ itemId: 'one', name: 'updated' }]);
        ordinary.given.forEventSource('A').events(new Counted(9000));
        (await ordinary.instance)!.items.should.deep.equal([{ itemId: 'one', name: 'updated' }]);
        (await ordinary.instance)!.total.should.equal(9000);
    });

    it('should compile one root count subscription', () => wire.From[0].Value.Properties.should.deep.equal({ total: '$count' }));
    it('should compile an explicitly typed child collection', () => schema.properties!.items.should.deep.equal({
        type: 'array', items: {
            $schema: 'https://json-schema.org/draft/2020-12/schema', title: 'Item', type: 'object',
            properties: { itemId: { type: 'string' }, name: { type: 'string' } },
            required: ['itemId', 'name'], additionalProperties: false
        }
    }));
});

describe('when counting a parent with fluent children and no initial values', () => {
    let result: Awaited<ReturnType<typeof lifecycle<Totals>>>;
    beforeAll(async () => { result = await lifecycle(new ReadModelScenario(Totals, artifacts)); });
    it('should count root events without assigning their same-named payload', () => result.first.total.should.equal(3));
    it('should update children without changing the root count', () => result.first.items.should.deep.equal([
        { itemId: 'one', name: 'updated' }, { itemId: 'two', name: 'second' }
    ]));
    it('should remove only the matching child and ignore unknown children', () => result.remaining.items.should.deep.equal([{ itemId: 'two', name: 'second' }]));
    it('should leave the other parent independent', () => [result.other.total, result.surviving.id, result.removed].should.deep.equal([1, 'B', null]));
    it('should discard old children and count on root recreation', () => [result.recreated.total, result.recreated.items].should.deep.equal([1, [{ itemId: 'new', name: 'recreated' }]]));
    it('should not count an unchanged repeated read twice', () => result.repeated.should.deep.equal(result.recreated));
});
