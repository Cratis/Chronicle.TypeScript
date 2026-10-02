// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { EventScenario } from './EventScenario.js';
import { seedScenario } from './EventScenarioSeed.js';

/** Seeds events in order through individual single appends, as in the .NET given builder. */
export class EventScenarioGiven {
    constructor(private readonly _scenario: EventScenario, private readonly _id: string, private readonly _options?: AppendOptions) {}
    async events(...events: object[]): Promise<void> {
        await seedScenario(this._scenario, this._id, events, this._options);
    }
}
