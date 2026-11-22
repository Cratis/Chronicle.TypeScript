// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelScenario } from '../../../ReadModelScenario.js';
import { Subtracted, ItemChanged, ItemRemoved, Removed } from './compiled_projection.js';

type SubtractedParent = { id: string; total: number; items: Array<{ itemId: string; name: string }> };

export function history(subtract: (amount: number) => object = amount => new Subtracted(amount)) {
    return [
        { source: 'A', event: subtract(2.5) }, { source: 'A', event: subtract(-1) },
        { source: 'A', event: new ItemChanged('one', 'first') }, { source: 'A', event: new ItemChanged('two', 'second') },
        { source: 'A', event: new ItemChanged('one', 'updated') }, { source: 'A', event: subtract(0) },
        { source: 'B', event: subtract(8) }, { source: 'B', event: new ItemChanged('one', 'independent') },
        { source: 'A', event: new ItemRemoved('one') }, { source: 'A', event: new ItemRemoved('unknown') },
        { source: 'A', event: new Removed() }, { source: 'A', event: subtract(4.5) },
        { source: 'A', event: new ItemChanged('new', 'recreated') }
    ];
}

export async function lifecycle<T extends SubtractedParent>(scenario: ReadModelScenario<T>) {
    const events = history();
    const seed = (start: number, end: number) => {
        for (const { source, event } of events.slice(start, end)) scenario.given.forEventSource(source).events(event);
    };
    seed(0, 8);
    const first = (await scenario.instanceForEventSourceId('A'))!;
    const other = (await scenario.instanceForEventSourceId('B'))!;
    seed(8, 10);
    const remaining = (await scenario.instanceForEventSourceId('A'))!;
    seed(10, 11);
    const removed = await scenario.instanceForEventSourceId('A');
    const surviving = (await scenario.instanceForEventSourceId('B'))!;
    seed(11, 13);
    const recreated = (await scenario.instanceForEventSourceId('A'))!;
    const repeated = (await scenario.instanceForEventSourceId('A'))!;
    return { first, other, remaining, removed, surviving, recreated, repeated };
}
