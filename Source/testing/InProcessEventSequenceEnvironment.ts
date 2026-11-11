// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import type { UnsupportedEventSequenceOperation } from './UnsupportedEventSequenceOperation.js';

/** Scenario-local dependencies used while preparing, but never committing, appends. */
export interface InProcessEventSequenceEnvironment {
    readonly catalog: ReadonlyMap<Function, ReturnType<typeof getEventTypeMetadata>>;
    readonly store: string;
    readonly namespace: string;
    readonly clock: () => Date;
    readonly correlationId?: () => string;
    readonly unsupported: (operation: string, artifact: string, reason: string) => UnsupportedEventSequenceOperation;
    readonly sequenceId: string;
}
