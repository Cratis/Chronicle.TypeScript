// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { chai, describe, it } from 'vitest';
import { addFrom } from '../../../projections/modelBound/addFrom.js';
import { clearWith } from '../../../projections/modelBound/clearWith.js';
import { count } from '../../../projections/modelBound/count.js';
import { decrement } from '../../../projections/modelBound/decrement.js';
import { increment } from '../../../projections/modelBound/increment.js';
import { noAutoMap } from '../../../projections/modelBound/noAutoMap.js';
import { removedWith } from '../../../projections/modelBound/removedWith.js';
import { setFrom } from '../../../projections/modelBound/setFrom.js';
import { setFromContext } from '../../../projections/modelBound/setFromContext.js';
import { setValue } from '../../../projections/modelBound/setValue.js';
import { subtractFrom } from '../../../projections/modelBound/subtractFrom.js';
import { ProjectionCapabilities } from '../ProjectionCapabilities.js';
import { Changed } from './given/Changed.js';
import { Removed } from './given/Removed.js';
import { compileDeclarative, compileModelBound } from './given/compile.js';

chai.should();

describe('when validating the phase-one projection subset', () => {
    const modelBound = [
        { name: 'root From and schema-inferred AutoMap', configure: () => {} },
        { name: 'setFrom and event source identity', configure: (model: Function) => setFrom(Changed, 'name')(model.prototype, 'name') },
        { name: 'setFromContext produces a valid event-content property', configure: (model: Function) => setFromContext(Changed, 'name')(model.prototype, 'state') },
        { name: 'constant text', configure: (model: Function) => setValue(Changed, 'ready')(model.prototype, 'state') },
        { name: 'scalar clearing', configure: (model: Function) => clearWith(Removed)(model.prototype, 'state') },
        { name: 'addition', configure: (model: Function) => addFrom(Changed, 'quantity')(model.prototype, 'total') },
        { name: 'subtraction', configure: (model: Function) => subtractFrom(Changed, 'quantity')(model.prototype, 'total') },
        { name: 'count', configure: (model: Function) => count(Changed)(model.prototype, 'total') },
        { name: 'increment', configure: (model: Function) => increment(Changed)(model.prototype, 'total') },
        { name: 'decrement', configure: (model: Function) => decrement(Changed)(model.prototype, 'total') },
        { name: 'root removal', configure: (model: Function) => removedWith(Removed)(model) },
        { name: 'AutoMap exclusions', configure: (model: Function) => noAutoMap(model.prototype, 'quantity') }
    ];
    for (const testCase of modelBound) {
        it(`should accept model-bound ${testCase.name} before any events are seeded`, () => {
            const { compiled, definition } = compileModelBound(testCase.configure);
            (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
        });
    }

    it('should accept declarative multiple root sources, explicit mappings, constants, arithmetic, and removal', () => {
        const { compiled, definition } = compileDeclarative(builder => builder
            .from(Changed, from => from.set(model => model.name).to(event => event.name)
                .set(model => model.id).toEventSourceId()
                .set(model => model.state).toValue('ready')
                .add(model => model.total).with(event => event.quantity)
                .subtract(model => model.total).with(event => event.quantity)
                .increment(model => model.total).decrement(model => model.total).count(model => model.total))
            .from(Removed).removedWith(Removed).withInitialValues(() => ({ id: '', name: '', quantity: 0, total: 0, state: 'new', labels: [], details: {} })));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    for (const expression of ['$eventContext(Occurred)', '$eventContext(Occurred.Date)']) {
        it(`should accept the compiled kernel context expression ${expression}`, () => {
            const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from.set(model => model.state).to(event => event.name)));
            definition.From[0].Value.Properties.state = expression;
            (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
        });
    }

    it('should accept declarative null clearing and an explicit null initial accumulator', () => {
        const { compiled, definition } = compileDeclarative(builder => builder
            .from(Changed, from => from.set(model => model.state).toValue(null).count(model => model.total))
            .withInitialValues(() => ({ id: '', name: '', quantity: 0, total: null as unknown as number, state: '', labels: [], details: {} })));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });

    it('should accept an ordinary object or array value without mistaking it for a child projection', () => {
        const { compiled, definition } = compileDeclarative(builder => builder.from(Changed, from => from
            .set(model => model.labels).to(event => event.labels)
            .set(model => model.details).to(event => event.details)));
        (() => ProjectionCapabilities.validate(compiled, definition)).should.not.throw();
    });
});
