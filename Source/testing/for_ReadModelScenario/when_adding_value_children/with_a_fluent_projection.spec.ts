// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { JsonSerializer } from '@cratis/fundamentals';
import { chai, describe, it } from 'vitest';
import { ReadModelScenario } from '../../ReadModelScenario.js';
import { Model, artifacts, history } from './given/compiled_projection.js';
import { assertOracleInput, oracleFixture } from './given/oracle_input.js';

chai.should();
describe('when adding plain-string value children through a fluent projection', () => {
    it('should compile exactly the kernel oracle input', () => assertOracleInput());

    it('should match every kernel prefix including repeated values, independent roots and removal/recreation', async () => {
        const scenario = new ReadModelScenario(Model, artifacts);
        const fixture = oracleFixture();
        for (const [index, { source, event }] of history().entries()) {
            scenario.given.forEventSource(source).events(event);
            const expected = fixture.expected[index].publicRead;
            for (const sourceId of ['A', 'B']) {
                const actual = await scenario.instanceForEventSourceId(sourceId);
                if (expected[sourceId]) JSON.parse(JsonSerializer.serialize(actual!)).should.deep.equal(expected[sourceId]);
                else (actual === null).should.be.true;
            }
        }
        const first = await scenario.instanceForEventSourceId('A');
        const repeated = await scenario.instanceForEventSourceId('A');
        first!.should.be.instanceOf(Model);
        first!.values.should.deep.equal(['after']);
        repeated!.should.deep.equal(first);
        (await scenario.instanceForEventSourceId('B'))!.values.should.deep.equal(['other']);
    });
});
