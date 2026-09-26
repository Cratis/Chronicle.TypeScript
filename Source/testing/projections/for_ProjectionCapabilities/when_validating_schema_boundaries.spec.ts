// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { ConceptAs, field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { JsonSchemaGenerator } from '../../../schemas/JsonSchemaGenerator.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';

chai.should();

class Timestamp extends ConceptAs<Date> { static readonly valueType = Date; }
class Details { created!: Date; }
class Dated { created!: Date; timestamp!: Timestamp; details!: Details; }
field(Date)(Details.prototype, 'created');
field(Date)(Dated.prototype, 'created');
field(Timestamp)(Dated.prototype, 'timestamp');
field(Details)(Dated.prototype, 'details');

function setModelSchema(compiled: ReturnType<typeof compileDeclarative>['compiled'], change: (properties: Record<string, JsonSchema>) => void): void {
    const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
    change(schema.properties!);
    compiled.readModels[0].Schema = JSON.stringify(schema);
}

describe('when validating schema-bound projection operations', () => {
    it('should accept generated date, date concept, and nested date formats for pass-through', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from
            .set(model => model.name).to(event => event.name)
            .set(model => model.state).to(event => event.name)
            .set(model => model.details).to(event => event.details)));
        const dates = JsonSchemaGenerator.generate(Dated).properties!;
        setModelSchema(compiled, properties => {
            properties.name = dates.created;
            properties.state = dates.timestamp;
            properties.details = dates.details;
        });
        const event = compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema;
        event.properties!.name = dates.created;
        event.properties!.details = dates.details;
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    it('should accept model-bound date pass-through and date AutoMap', () => {
        const { compiled, definition } = compileModelBound(model => setFrom(Changed, 'name')(model.prototype, 'state'));
        const date = JsonSchemaGenerator.generate(Dated).properties!.created;
        setModelSchema(compiled, properties => { properties.name = date; properties.state = date; });
        compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.name = date;
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    const mismatches: Array<{ name: string; source: JsonSchema; target: JsonSchema }> = [
        { name: 'date-time to string', source: { type: 'string', format: 'date-time' }, target: { type: 'string' } },
        { name: 'boolean to string', source: { type: 'boolean' }, target: { type: 'string' } },
        { name: 'number to integer', source: { type: 'number', format: 'double' }, target: { type: 'integer', format: 'int32' } },
        { name: 'object to scalar', source: { type: 'object', properties: { other: { type: 'string' } } }, target: { type: 'string' } },
        { name: 'concept-shaped object to object', source: { type: 'object', properties: { value: { type: 'integer', format: 'int32' } } },
            target: { type: 'object', properties: { value: { type: 'integer', format: 'int32' } } } }
    ];
    for (const mapping of mismatches) {
        for (const autoMap of [false, true]) {
            it(`should reject ${mapping.name} for ${autoMap ? 'AutoMap' : 'setFrom'} with the declaration and path`, () => {
                const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => {
                    if (!autoMap) from.set(model => model.name).to(event => event.name);
                }));
                setModelSchema(compiled, properties => { properties.name = mapping.target; });
                compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.name = mapping.source;
                (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                    .with.property('message').that.includes(`From[capability-changed:1].${autoMap ? 'AutoMap' : 'Properties'}.name`)
                    .and.includes(autoMap ? '.from (AutoMap)' : '.from().set')
                    .and.includes('requires a kernel-backed test');
            });
        }
    }

    for (const [property, target, value, reason] of [
        ['state', { type: 'boolean' }, 'yes', 'initial boolean value must be a JSON boolean'],
        ['total', { type: 'integer', format: 'int32' }, '5', 'initial numeric value must be a JSON number'],
        ['state', { type: 'string', format: 'guid' }, 'not-a-guid', 'initial GUID value must be canonical lowercase text']
    ] as const) {
        it(`should reject incompatible initial value for ${property}`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
            setModelSchema(compiled, properties => { properties[property] = target; });
            definition.InitialModelState = JSON.stringify({ [property]: value });
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(`InitialModelState.${property} (.withInitialValues)`)
                .and.includes(reason);
        });
    }

    it('should reject unproven initial date-time, object and array values', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        for (const [property, value] of [['state', '2026-01-01T00:00:00.000Z'], ['details', {}], ['labels', []]] as const) {
            if (property === 'state') setModelSchema(compiled, properties => { properties.state = { type: 'string', format: 'date-time' }; });
            definition.InitialModelState = JSON.stringify({ [property]: value });
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(`InitialModelState.${property}`);
        }
    });

    it('should accept $null for a date destination', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).toValue(null)));
        setModelSchema(compiled, properties => { properties.state = { type: 'string', format: 'date-time' }; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    for (const expression of ['$value(2026-01-01T00:00:00.000Z)', '$increment', '$add(quantity)']) {
        it(`should reject ${expression} against a date destination`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).to(event => event.name)));
            setModelSchema(compiled, properties => { properties.state = { type: 'string', format: 'date-time' }; });
            definition.From[0].Value.Properties.state = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(`expression '${expression}'`);
        });
    }

    it('should use a string key when neither id nor Id exists', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        setModelSchema(compiled, properties => { delete properties.id; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    it('should use Id when id is absent, but prefer id when both exist', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        setModelSchema(compiled, properties => { properties.Id = { type: 'string' }; delete properties.id; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
        setModelSchema(compiled, properties => { properties.id = { type: 'boolean' }; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation, 'ReadModel.Schema.id');
    });

    it('should not treat ID as the kernel identifier', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        setModelSchema(compiled, properties => { delete properties.id; properties.ID = { type: 'boolean' }; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    it('should skip AutoMap validation for arithmetic-only events', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
        setModelSchema(compiled, properties => { properties.name.format = 'float'; });
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    for (const [expression, destination, reason] of [
        ['$value(maybe)', 'state', '$value boolean literal'],
        ['$value(not-a-guid)', 'state', '$value GUID literal'],
        ['$value(text)', 'details', '$value object/array literals'],
        ['$value(text)', 'labels', '$value object/array literals']
    ]) {
        it(`should reject invalid ${expression} for ${destination} (${reason})`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
            setModelSchema(compiled, properties => {
                if (reason.includes('boolean')) properties.state = { type: 'boolean' };
                if (reason.includes('GUID')) properties.state = { type: 'string', format: 'guid' };
            });
            definition.From[0].Value.Properties[destination] = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(reason).and.includes(`expression '${expression}'`);
        });
    }
});
