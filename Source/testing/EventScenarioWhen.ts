// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { EventScenario } from './EventScenario.js';
import { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** A single act-phase append; the plural form is reserved for atomic batches. */
export class EventScenarioWhen {
    constructor(private readonly _scenario: EventScenario, private readonly _id: string) {}
    async event(event: object): Promise<AppendResult> { return this._scenario.append(this._id, event); }
    events(..._events: object[]): Promise<readonly AppendResult[]> {
        throw new UnsupportedEventSequenceOperation('when.events/appendMany', this._id,
            'Even a one-event plural action uses kernel batch semantics; batch fixtures are not included.');
    }
}
