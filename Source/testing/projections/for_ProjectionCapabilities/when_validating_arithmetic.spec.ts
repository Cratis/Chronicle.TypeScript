// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, describe, it } from 'vitest';
import { count } from '../../../projections/modelBound/count.js';
import { increment } from '../../../projections/modelBound/increment.js';
import { decrement } from '../../../projections/modelBound/decrement.js';
import type { JsonSchema } from '../../../schemas/JsonSchema.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { UnsupportedProjectionOperation } from '../UnsupportedProjectionOperation.js';
import { Changed } from './given/Changed.js';
import { Removed } from './given/Removed.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';

chai.should();

describe('when validating arithmetic before replay', () => {
    for (const expression of ['$add(quantity)', '$subtract(quantity)', '$count', '$increment', '$decrement']) {
        it(`should admit ${expression} on number fields without seeding events`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed));
            definition.From[0].Value.Properties.total = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
        });
    }

    for (const expression of ['$add(name)', '$subtract(name)', '$add(missing)', '$add(inner.quantity)', '$subtract($eventSourceId)', '$add($value(1))', '$add(true)', '$add()']) {
        it(`should reject unproven arithmetic operands in ${expression} with the contract path`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
            definition.From[0].Value.Properties.total = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('From[capability-changed:1].Properties.total (.from().addFrom)').and.includes('arithmetic');
        });
    }

    for (const target of [{ type: 'integer', format: 'uint32' }, { type: ['number', 'null'] }, { type: 'string' }, { type: 'boolean' }]) {
        it(`should reject an unproven ${JSON.stringify(target)} accumulator schema`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.increment(model => model.total)));
            const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
            schema.properties!.total = target as JsonSchema;
            compiled.readModels[0].Schema = JSON.stringify(schema);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('From[capability-changed:1].Properties.total');
        });
    }

    for (const source of [{ type: 'boolean' }, { type: 'object' }, { type: ['number', 'null'] }, { type: 'number', format: 'decimal' }, { type: 'integer', format: 'int64' }]) {
        it(`should reject an unproven ${JSON.stringify(source)} operand schema`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
            compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.quantity = source as JsonSchema;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes('arithmetic operands must have number/double');
        });
    }

    it('should reject arithmetic on a protected operand', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.add(model => model.total).with(event => event.quantity)));
        compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.quantity.security = [{ metadataType: 'EncryptedSubject', details: '' }];
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('protected arithmetic operands');
    });

    it('should reject any declaration that can clear an accumulator before arithmetic', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.increment(model => model.total))
            .from(Removed, from => from.set(model => model.total).toValue(0)));
        definition.From[1].Value.Properties.total = '$null';
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('From[capability-removed:1].Properties.total').and.includes('clearing an arithmetic accumulator');
    });

    it('should reject a text assignment that can clear an arithmetic accumulator', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.total).to(event => event.name))
            .from(Removed, from => from.increment(model => model.total)));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('assigning non-numeric event properties to an arithmetic accumulator');
    });

    it('should reject inferred text AutoMap that can clear an arithmetic accumulator', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed)
            .from(Removed, from => from.increment(model => model.total)));
        compiled.eventSchemas.get(definition)!.get('capability-changed:1:0')!.schema.properties!.total = { type: 'string' };
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('AutoMap.total').and.includes('assigning non-numeric event properties');
    });

    it('should reject root arithmetic combined with children without widening the child boundary', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.increment(model => model.total))
            .children(model => model.labels, child => child.from(Removed)));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
            .with.property('message').that.includes('root arithmetic combined with children');
    });

    for (const [name, decorate] of [['count', count], ['increment', increment], ['decrement', decrement]] as const) {
        it(`should keep @${name} constant keys outside the supported source-id shape`, () => {
            const { compiled, definition } = compileModelBound(model => decorate(Removed, 'all')(model.prototype, 'total'));
            (() => ProjectionCapabilities.validate(compiled, definition)).should.throw(UnsupportedProjectionOperation)
                .with.property('message').that.includes(`(@${name})`).and.includes('only $eventSourceId keys');
        });
    }

    it('should not validate suppressed AutoMap as an executed mapping', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.increment(model => model.total)));
        const schema = JSON.parse(compiled.readModels[0].Schema) as JsonSchema;
        schema.properties!.quantity = { type: 'number', format: 'decimal' };
        compiled.readModels[0].Schema = JSON.stringify(schema);
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });
});
