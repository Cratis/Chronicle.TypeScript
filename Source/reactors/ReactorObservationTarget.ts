// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ClientArtifactsActivator } from '../artifacts/ClientArtifactsActivator.js';
import type { IEventLog } from '../eventSequences/IEventLog.js';
import type { createLogger } from '../logging/createLogger.js';
import type { IChronicleLogger } from '../logging/IChronicleLogger.js';
import type { BatchMethod } from '../observation/batches/BatchMethod.js';
import type { ReactorEventTypeEntry } from './ReactorDispatcher.js';
import type { ReactorResultHandler } from './ReactorResultHandler.js';
import type { ReactorServices } from './ReactorServices.js';

/** Everything a {@link ReactorPageDispatcher} needs to know about one reactor observation. */
export interface ReactorObservationTarget {
    /** The reactor identifier. */
    readonly id: string;
    /** The reactor class. */
    readonly reactorType: Constructor;
    /** The event sequence the reactor observes. */
    readonly eventSequenceId: string;
    /** The event store the reactor is registered with. */
    readonly eventStoreName: string;
    /** The namespace the reactor is registered in. */
    readonly namespace: string;
    /** The per-event handlers. */
    readonly entries: readonly ReactorEventTypeEntry[];
    /** The batch methods. */
    readonly batchMethods: readonly BatchMethod[];
    /** Rejects instances whose fields hide decorated methods. */
    readonly validateInstance: (instance: object) => void;
    /** The long-lived reactor instance, or undefined when instances are activated per delivery. */
    readonly reactorInstance: Record<string, Function> | undefined;
    /** The services handed to per-event handlers. */
    readonly services: ReactorServices | undefined;
    /** Aborted when the observation stops. */
    readonly signal: AbortSignal;
    /** The event log side effects returned by per-event handlers are appended to. */
    readonly eventLog: IEventLog;
    /** Optional handler of side-effect results. */
    readonly resultHandler?: ReactorResultHandler;
    /** Optional per-delivery activator. */
    readonly artifactActivator?: ClientArtifactsActivator;
    /** The reactor logger. */
    readonly logger: ReturnType<typeof createLogger>;
    /** The connection logger, for activation diagnostics. */
    readonly connectionLogger?: IChronicleLogger;
}
