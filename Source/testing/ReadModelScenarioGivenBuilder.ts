// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelScenario } from './ReadModelScenario.js';
import { ReadModelScenarioGiven } from './ReadModelScenarioGiven.js';

/** Selects the event source for events seeded into a read model scenario. */
export class ReadModelScenarioGivenBuilder<TReadModel extends object> {
    constructor(private readonly _scenario: ReadModelScenario<TReadModel>) {}

    /** Creates a builder for the selected event source. */
    forEventSource(id: string): ReadModelScenarioGiven<TReadModel> {
        return new ReadModelScenarioGiven(this._scenario, id);
    }
}
