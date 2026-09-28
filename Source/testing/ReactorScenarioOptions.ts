// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import type { IEventStore } from '../IEventStore.js';
import type { ReactorResultHandler } from '../reactors/ReactorResultHandler.js';
import type { EventScenarioOptions } from './EventScenarioOptions.js';

/** Reactor delivery over a fixture-bounded EventScenario catalog. */
export interface ReactorScenarioOptions extends EventScenarioOptions {
    /** Production activation hook, including constructor injection and per-delivery completion. */
    artifactActivator?: ClientArtifactsActivator;
    /** Optional explicit test double; without one only the event log is available through services. */
    servicesEventStore?: IEventStore;
    /** Application result hook. A true result claims the entire return value; false uses event recording. */
    resultHandler?: ReactorResultHandler;
    /** Reserved for a later increment; commands cannot be classified in basic reactor scenarios. */
    commandTypes?: Constructor[];
}
