// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { EventContext } from '../events/EventContext.js';

/** An event serialized at the scenario boundary. */
export type ScenarioEvent = { sourceId: string; content: unknown; context: EventContext };
