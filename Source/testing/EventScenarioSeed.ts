// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventScenario } from './EventScenario.js';

const seeders = new WeakMap<EventScenario, (source: string, events: object[]) => Promise<void>>();

/** Internal builder wiring; not exported by the testing package. */
export function registerScenarioSeed(scenario: EventScenario, seed: (source: string, events: object[]) => Promise<void>): void {
    seeders.set(scenario, seed);
}

export function seedScenario(scenario: EventScenario, source: string, events: object[]): Promise<void> {
    const seed = seeders.get(scenario);
    if (!seed) throw new Error('EventScenario setup requires a constructed scenario.');
    return seed(source, events);
}
