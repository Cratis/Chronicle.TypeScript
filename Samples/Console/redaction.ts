// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { EventSequenceNumber, IEventStore } from '@cratis/chronicle';
import { EmployeeEmailSet } from './events';
import { Person } from './employees';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/RedactionExample' });

/**
 * Permanently redacts the most recently appended `EmployeeEmailSet` event for the given
 * employee.
 *
 * Redaction is **not** a soft-delete or a field-level mask — it is a permanent,
 * destructive rewrite of the event's content at the storage level. The event keeps its
 * place in the stream (its sequence number is never reused or renumbered), but once this
 * call completes the original payload is gone forever; there is no way to recover it.
 * Use single-event redaction when one specific fact needs correcting or erasing under a
 * compliance request, while the rest of the employee's history stays intact.
 *
 * @param store - The event store to redact from.
 * @param person - The employee whose most recent email-set event should be redacted.
 */
export async function redactLastEmailChange(store: IEventStore, person: Person): Promise<void> {
    // getForEventSourceIdAndEventTypes lets us find the exact event to redact rather than
    // guessing a sequence number — here, the employee's most recently appended email change.
    const emailEvents = await store.eventLog.getForEventSourceIdAndEventTypes(person.id, [EmployeeEmailSet]);
    if (emailEvents.length === 0) {
        console.log(`[redact] ${person.firstName} ${person.lastName} has no email-set event to redact yet. Press 'E' first.`);
        return;
    }

    const mostRecent = emailEvents[emailEvents.length - 1];
    const sequenceNumber = new EventSequenceNumber(mostRecent.context.sequenceNumber);
    await store.eventLog.redact(sequenceNumber, 'Console sample: correcting a mistakenly entered email address');

    logger.info('Redacted event', { eventSourceId: person.id, sequenceNumber: sequenceNumber.value.toString() });
    console.log(`[redact] Permanently redacted the EmployeeEmailSet event at sequence ${sequenceNumber.value} for ${person.firstName} ${person.lastName}. This cannot be undone.`);
}

/**
 * Permanently erases every event ever appended for the given employee's event source — a
 * full GDPR-style "right to be forgotten" erasure, not a partial mask.
 *
 * Unlike {@link redactLastEmailChange}, which redacts a single fact, this redacts the
 * employee's **entire** history: hiring, promotions, address changes, everything. After
 * this call completes, replaying this event source produces only redacted (empty)
 * content at every sequence number the employee ever appended to — the facts themselves
 * are gone, permanently. Only use this when the whole event source must be erased, e.g.
 * because the person has exercised their right to erasure.
 *
 * @param store - The event store to redact from.
 * @param person - The employee whose entire event history should be erased.
 */
export async function eraseEmployee(store: IEventStore, person: Person): Promise<void> {
    await store.eventLog.redactForEventSource(person.id, 'Console sample: GDPR erasure request');

    logger.info('Redacted all events for event source', { eventSourceId: person.id });
    console.log(`[redact] Permanently erased ALL events for ${person.firstName} ${person.lastName} (${person.id}). This cannot be undone.`);
}
