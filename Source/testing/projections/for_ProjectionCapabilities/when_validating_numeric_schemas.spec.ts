// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { compileDeclarative } from './given/compile.js';

chai.should();

describe('when validating the numeric capability matrix', () => {
    for (const format of ['int32', 'uint32']) {
        it(`should accept ${format} arithmetic with a matching event operand and literal`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from
                .add(model => model.total).with(event => event.quantity)
                .set(model => model.quantity).toValue(12)));
            const modelSchema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string }; quantity: { type: string; format?: string } } };
            modelSchema.properties.total = { type: 'integer', format };
            modelSchema.properties.quantity = { type: 'integer', format };
            compiled.readModels[0].Schema = JSON.stringify(modelSchema);
            const eventSchema = compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema;
            eventSchema.properties!.quantity = { type: 'integer', format };
            (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
        });
    }

    it('should accept GUID identifiers and finite double arithmetic', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { id: { type: string; format?: string }; total: { format?: string } } };
        schema.properties.id.format = 'guid';
        schema.properties.total.format = 'double';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    it('should accept numeric identifiers with a declared number schema', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { id: { type: string } } };
        schema.properties.id.type = 'number';
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    for (const value of [12.5, 2147483648, 9007199254740992]) {
        it(`should reject an int32 $value literal outside the integer range (${value})`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.total).toValue(value)));
            const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string } } };
            schema.properties.total = { type: 'integer', format: 'int32' };
            compiled.readModels[0].Schema = JSON.stringify(schema);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('$value numeric literal is outside');
        });
    }

    it('should reject a double event operand into an integer accumulator before replay', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string } } };
        schema.properties.total = { type: 'integer', format: 'int32' };
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('same integer/number kind');
    });

    it('should reject an int32 $value literal with a fractional spelling even if its value is integral', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.total).toValue(1)));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string } } };
        schema.properties.total = { type: 'integer', format: 'int32' };
        compiled.readModels[0].Schema = JSON.stringify(schema);
        definition.From[0].Value.Properties.total = '$value(1.0)';
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('$value numeric literal is outside');
    });

    it('should reject an overflowing initial integer value', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed)
            .withInitialValues(() => ({ id: '', name: '', quantity: 0, total: 2147483648, state: '', labels: [], details: {} })));
        const schema = JSON.parse(compiled.readModels[0].Schema) as { properties: { total: { type: string; format?: string } } };
        schema.properties.total = { type: 'integer', format: 'int32' };
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('InitialModelState.total (.withInitialValues)');
    });

    it('should reject unsafe int64 operands instead of losing precision', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
        compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.quantity.format = 'int64';
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('arithmetic operand requires a supported numeric event schema');
    });
});
