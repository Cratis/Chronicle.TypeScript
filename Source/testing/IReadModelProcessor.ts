// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ReadModelState } from './ReadModelState.js';
import type { ScenarioEvent } from './ScenarioEvent.js';

/** Replays the complete serialized scenario history for independent event sources. */
export interface IReadModelProcessor<TReadModel extends object> {
    process(events: readonly ScenarioEvent[]): Promise<Map<string, ReadModelState<TReadModel>>>;
}
