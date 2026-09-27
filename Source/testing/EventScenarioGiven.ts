// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventScenario } from './EventScenario.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** Seeds exactly one event through the ordinary single-append pipeline. */
export class EventScenarioGiven {
    constructor(private readonly _scenario: EventScenario, private readonly _id: string) {}
    events(...events: object[]): Promise<void> {
        if (events.length !== 1) throw new UnsupportedEventSequenceOperation('given.events', this._id,
            'Zero or multiple setup events are not supported in this increment; call events once per event.');
        return this._scenario.seed(this._id, events[0]);
    }
}
