// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventScenario } from './EventScenario.js';
import { EventScenarioGiven } from './EventScenarioGiven.js';

/** Selects the source for setup events. */
export class EventScenarioGivenBuilder {
    constructor(private readonly _scenario: EventScenario) {}
    forEventSource(id: string): EventScenarioGiven { return new EventScenarioGiven(this._scenario, id); }
}
