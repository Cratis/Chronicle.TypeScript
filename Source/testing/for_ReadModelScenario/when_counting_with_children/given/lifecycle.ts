// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelScenario } from '../../../ReadModelScenario.js';
import { Counted, ItemChanged, ItemRemoved, Removed } from './compiled_projection.js';

type CountedParent = { id: string; total: number; items: Array<{ itemId: string; name: string }> };

export async function lifecycle<T extends CountedParent>(scenario: ReadModelScenario<T>) {
    scenario.given.forEventSource('A').events(new Counted(9000), new Counted(8000));
    scenario.given.forEventSource('A').events(new ItemChanged('one', 'first'), new ItemChanged('two', 'second'), new ItemChanged('one', 'updated'), new Counted(7000));
    scenario.given.forEventSource('B').events(new Counted(6000), new ItemChanged('one', 'independent'));
    const first = (await scenario.instanceForEventSourceId('A'))!;
    const other = (await scenario.instanceForEventSourceId('B'))!;
    scenario.given.forEventSource('A').events(new ItemRemoved('one'), new ItemRemoved('unknown'));
    const remaining = (await scenario.instanceForEventSourceId('A'))!;
    scenario.given.forEventSource('A').events(new Removed());
    const removed = await scenario.instanceForEventSourceId('A');
    const surviving = (await scenario.instanceForEventSourceId('B'))!;
    scenario.given.forEventSource('A').events(new Counted(5000), new ItemChanged('new', 'recreated'));
    const recreated = (await scenario.instanceForEventSourceId('A'))!;
    const repeated = (await scenario.instanceForEventSourceId('A'))!;
    return { first, other, remaining, removed, surviving, recreated, repeated };
}
