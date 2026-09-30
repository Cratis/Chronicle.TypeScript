// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { EventSequenceId } from '../eventSequences/EventSequenceId.js';

/** Configuration captured once when constructing an event scenario. */
export interface EventScenarioOptions {
    /** An isolated catalog; omitting it discovers process-wide event and constraint artifacts. */
    artifacts?: { eventTypes: Constructor[]; constraints?: Constructor[]; eventTypeMigrations?: Constructor[] };
    /** Constraint discovery is the default. Explicitly disable it only for tests without constraints. */
    constraints?: 'disabled';
    /** Scenario-local identifiers; only the fixture-backed defaults are supported in this increment. */
    eventStore?: string;
    namespace?: string;
    eventSequenceId?: EventSequenceId;
    /** Deterministic sources for metadata otherwise provided by the environment. */
    clock?: () => Date;
    correlationId?: () => string;
}
