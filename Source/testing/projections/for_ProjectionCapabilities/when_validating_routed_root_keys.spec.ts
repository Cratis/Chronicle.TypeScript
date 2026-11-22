// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { AutoMap } from '@cratis/chronicle.contracts';
import type { ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { fluent } from '../../for_ReadModelScenario/when_routing_root_events/given/compiled_projection.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';

chai.should();

function candidate() {
    const compiled = fluent.compile();
    const definition = compiled.definitions[0];
    const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
    const eventSchema = [...compiled.eventSchemas.get(definition)!.values()][0].schema;
    return { compiled, definition, schema, eventSchema };
}

function rejects(change: (definition: ProjectionDefinition, schema: JsonSchema, eventSchema: JsonSchema) => void) {
    const { compiled, definition, schema, eventSchema } = candidate();
    change(definition, schema, eventSchema);
    compiled.readModels[0].Schema = JSON.stringify(schema);
    (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation);
}

describe('when validating routed root keys', () => {
    it('should accept the exact compiler-derived plain-string shape', () => {
        const { compiled, definition } = candidate();
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    for (const key of ['$eventContext(EventSourceId)', '$value(A)', 'nested.targetId', '$composite(targetId)', 'missing', 'true']) {
        it(`should reject the unmeasured key ${key}`, () => rejects(definition => { definition.From[0].Value.Key = key; }));
    }

    for (const property of [{ type: 'number' }, { type: ['string', 'null'] }, { type: 'string', format: 'guid' }, { type: 'object' }]) {
        it(`should reject a key schema ${JSON.stringify(property)}`, () => rejects((_definition, _schema, eventSchema) => {
            eventSchema.properties!.targetId = property as JsonSchema;
        }));
        it(`should reject an identifier schema ${JSON.stringify(property)}`, () => rejects((_definition, schema) => {
            schema.properties!.id = property as JsonSchema;
        }));
    }

    it('should reject parent-key routing', () => rejects(definition => { definition.From[0].Value.ParentKey = 'targetId'; }));
    it('should reject a second root event', () => rejects(definition => {
        definition.From.push({ ...definition.From[0], Key: { ...definition.From[0].Key, Id: 'Other' } });
    }));
    it('should reject root removal', () => rejects(definition => { definition.RemovedWith.push(definition.From[0]); }));
    it('should reject a join', () => rejects(definition => { definition.Join.push(definition.From[0]); }));
    it('should reject children', () => rejects(definition => {
        definition.Children.children = { ...definition, IdentifiedBy: 'id' };
    }));
    it('should reject nested projections', () => rejects(definition => { definition.Nested.other = definition; }));
    it('should reject root arithmetic', () => rejects(definition => { definition.From[0].Value.Properties.name = '$count'; }));
    it('should reject context mappings', () => rejects(definition => {
        definition.From[0].Value.Properties.name = '$eventContext(Subject)';
    }));
    it('should reject disabled AutoMap', () => rejects(definition => { definition.AutoMap = AutoMap.Disabled; }));
    it('should reject initial values', () => rejects(definition => { definition.InitialModelState = '{"name":"initial"}'; }));
});
