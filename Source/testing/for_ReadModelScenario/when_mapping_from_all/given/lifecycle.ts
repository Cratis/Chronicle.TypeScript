// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { chai, type Assertion } from 'vitest';
import type { ReadModelScenario } from '../../../ReadModelScenario.js';
import { history, type Model } from './compiled_projection.js';

chai.should();
function should(value: unknown): Assertion { return (value as { should: Assertion }).should; }

export async function assertLifecycle<T extends Model>(scenario: ReadModelScenario<T>): Promise<void> {
    const events = history();
    const seed = (start: number, end: number) => {
        for (const { source, event } of events.slice(start, end)) scenario.given.forEventSource(source).events(event);
    };
    seed(0, 1);
    should(JSON.parse(JSON.stringify(await scenario.instanceForEventSourceId('C')))).deep.equal({ id: 'C', lastSequence: '0' });
    seed(1, 4);
    should(await scenario.instanceForEventSourceId('A')).deep.equal({ id: 'A', name: 'updated', lastSequence: '3' });
    seed(4, 7);
    should(await scenario.instanceForEventSourceId('A')).deep.equal({ id: 'A', name: 'created again', lastSequence: '6' });
    const other = await scenario.instanceForEventSourceId('B');
    should(other).deep.equal({ id: 'B', name: 'other', lastSequence: '5' });
    seed(7, 8);
    should(await scenario.instanceForEventSourceId('A') === null).be.true;
    seed(8, 9);
    should(JSON.parse(JSON.stringify(await scenario.instanceForEventSourceId('A')))).deep.equal({ id: 'A', lastSequence: '8' });
    should(await scenario.instanceForEventSourceId('B')).deep.equal(other);
    seed(9, 10);
    should(await scenario.instanceForEventSourceId('A')).deep.equal({ id: 'A', name: 'recreated', lastSequence: '9' });
    seed(10, 12);
    const final = await scenario.instanceForEventSourceId('A');
    should(final).deep.equal({ id: 'A', name: 'final', lastSequence: '10' });
    should(await scenario.instanceForEventSourceId('A')).deep.equal(final);
    should(await scenario.instanceForEventSourceId('C') === null).be.true;
}
