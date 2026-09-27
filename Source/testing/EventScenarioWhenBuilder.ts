// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventScenario } from './EventScenario.js';
import { EventScenarioWhen } from './EventScenarioWhen.js';

/** Selects the source for an act-phase append. */
export class EventScenarioWhenBuilder {
    constructor(private readonly _scenario: EventScenario) {}
    forEventSource(id: string): EventScenarioWhen { return new EventScenarioWhen(this._scenario, id); }
}
