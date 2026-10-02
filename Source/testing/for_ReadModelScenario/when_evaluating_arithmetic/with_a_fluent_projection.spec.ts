// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { eventType } from '../../../events/eventTypeDecorator.js';
import type { IProjectionBuilderFor } from '../../../projections/declarative/IProjectionBuilderFor.js';
import { projection } from '../../../projections/declarative/projection.js';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { UnsupportedProjectionOperation } from '../../projections/UnsupportedProjectionOperation.js';

chai.should();

class Changed {
    constructor(readonly amount: number) {}
}
field(Number)(Changed.prototype, 'amount');
eventType('fluent-arithmetic-changed')(Changed);
class Removed {}
eventType('fluent-arithmetic-removed')(Removed);
class Totals {
    id = '';
    added = 0;
    subtracted = 0;
    counted = 0;
    incremented = 0;
    decremented = 0;
}
field(String)(Totals.prototype, 'id');
for (const property of ['added', 'subtracted', 'counted', 'incremented', 'decremented']) field(Number)(Totals.prototype, property);
class TotalsProjection {
    define(builder: IProjectionBuilderFor<Totals>): void {
        builder.noAutoMap().withInitialValues(() => ({ id: '', added: 10, subtracted: 10, counted: 0, incremented: 0, decremented: 0 }))
            .from(Changed, from => from.add(model => model.added).with(event => event.amount)
                .subtract(model => model.subtracted).with(event => event.amount)
                .count(model => model.counted).increment(model => model.incremented).decrement(model => model.decremented))
            .removedWith(Removed);
    }
}
projection('fluent-arithmetic', Totals)(TotalsProjection);
const artifacts = { eventTypes: [Changed, Removed], projections: [TotalsProjection], reducers: [] };

describe('when evaluating arithmetic with a fluent projection', () => {
    for (const operation of ['add', 'subtract'] as const) {
        it(`should reject fluent ${operation} with a snake_case operand before any events are seeded`, () => {
            class PriceChanged {
                unit_price = 2;
            }
            field(Number)(PriceChanged.prototype, 'unit_price');
            eventType(`fluent-arithmetic-snake-case-${operation}`)(PriceChanged);
            class PriceTotals {
                id = '';
                total = 0;
            }
            field(String)(PriceTotals.prototype, 'id');
            field(Number)(PriceTotals.prototype, 'total');
            class PriceProjection {
                define(builder: IProjectionBuilderFor<PriceTotals>): void {
                    builder.from(PriceChanged, from => from[operation](model => model.total).with(event => event.unit_price));
                }
            }
            projection(`fluent-arithmetic-snake-case-${operation}`, PriceTotals)(PriceProjection);
            (() => new ReadModelScenario(PriceTotals, { eventTypes: [PriceChanged], projections: [PriceProjection], reducers: [] }))
                .should.throw(UnsupportedProjectionOperation).with.property('message')
                .that.includes('kernel only permits an underscore as the first character')
                .and.includes('https://github.com/Cratis/Chronicle/issues/4491');
        });
    }

    it('should apply all five property operations to initial values', async () => {
        const scenario = new ReadModelScenario(Totals, artifacts);
        scenario.given.forEventSource('A').events(new Changed(2.5), new Changed(-1));
        const result = (await scenario.instance)!;
        [result.added, result.subtracted, result.counted, result.incremented, result.decremented].should.deep.equal([11.5, 8.5, 2, 2, -2]);
    });

    it('should discard the accumulator on removal and reapply initial values on recreation', async () => {
        const scenario = new ReadModelScenario(Totals, artifacts);
        scenario.given.forEventSource('A').events(new Changed(3), new Removed());
        (await scenario.wasDeletedForEventSourceId('A')).should.be.true;
        scenario.given.forEventSource('A').events(new Changed(4));
        const result = (await scenario.instance)!;
        [result.added, result.counted].should.deep.equal([14, 1]);
    });
});
