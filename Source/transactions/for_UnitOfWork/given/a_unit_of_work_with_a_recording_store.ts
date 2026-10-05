// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Guid } from '@cratis/fundamentals';
import { vi, type Mock } from 'vitest';
import type { AppendOptions } from '../../../eventSequences/AppendOptions.js';
import type { AppendResult } from '../../../eventSequences/AppendResult.js';
import type { EventForEventSourceId } from '../../../eventSequences/EventForEventSourceId.js';
import { EventSequenceNumber } from '../../../eventSequences/EventSequenceNumber.js';
import type { IEventStore } from '../../../IEventStore.js';
import { UnitOfWork } from '../../UnitOfWork.js';

/** One recorded appendMany call. */
export interface RecordedAppend {
    readonly eventSequenceId: string;
    readonly events: EventForEventSourceId[];
    readonly options: AppendOptions;
}

/** Creates a successful append result with a given sequence number. */
export function successfulAppendResult(sequenceNumber: bigint): AppendResult {
    return { sequenceNumber: new EventSequenceNumber(sequenceNumber), constraintViolations: [], errors: [], isSuccess: true, waitForCompletion: vi.fn() };
}

/** The unit of work and what its store recorded. */
export interface RecordingUnitOfWork {
    readonly unitOfWork: UnitOfWork;
    readonly appends: RecordedAppend[];
    readonly record: Mock;
    readonly completed: Mock;
}

/**
 * Creates a unit of work over a store whose event sequences record every appendMany call.
 * @param appendMany - Optional replacement for the recording appendMany; receives the sequence id first.
 */
export function a_unit_of_work_with_a_recording_store(
    appendMany?: (eventSequenceId: string, events: EventForEventSourceId[], options: AppendOptions) => Promise<AppendResult[]>
): RecordingUnitOfWork {
    const appends: RecordedAppend[] = [];
    let next = 0n;
    const record: Mock = vi.fn(async (eventSequenceId: string, events: EventForEventSourceId[], options: AppendOptions) => {
        appends.push({ eventSequenceId, events, options });
        return appendMany ? appendMany(eventSequenceId, events, options) : events.map(() => successfulAppendResult(next++));
    });
    const store = {
        getEventSequence: (id: { value: string }) => ({
            appendMany: (events: EventForEventSourceId[], options: AppendOptions) => record(id.value, events, options)
        })
    } as unknown as IEventStore;
    const completed = vi.fn();
    const unitOfWork = new UnitOfWork(Guid.create(), completed, store);
    return { unitOfWork, appends, record, completed };
}
