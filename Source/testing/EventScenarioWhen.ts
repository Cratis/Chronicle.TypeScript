// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { AppendOptions } from '../eventSequences/AppendOptions.js';
import type { AppendResult } from '../eventSequences/AppendResult.js';
import type { EventScenario } from './EventScenario.js';

/** A single act-phase append; the plural form is reserved for atomic batches. */
export class EventScenarioWhen {
    constructor(private readonly _scenario: EventScenario, private readonly _id: string, private readonly _options?: AppendOptions) {}
    async event(event: object): Promise<AppendResult> { return this._scenario.append(this._id, event, this._options); }
    async events(...events: object[]): Promise<readonly AppendResult[]> {
        return this._scenario.appendMany(this._id, events, this._options);
    }
}
