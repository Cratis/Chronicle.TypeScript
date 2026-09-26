// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelScenario } from './ReadModelScenario.js';

/** Seeds events belonging to one event source, in the order provided. */
export class ReadModelScenarioGiven<TReadModel extends object> {
    /** Creates a builder for the selected event source. */
    constructor(private readonly _scenario: ReadModelScenario<TReadModel>, private readonly _eventSourceId: string) {}

    /** Adds events to the scenario without connecting to a Chronicle kernel. */
    events(...events: object[]): ReadModelScenario<TReadModel> {
        this._scenario.collectEventsFor(this._eventSourceId, events);
        return this._scenario;
    }
}
