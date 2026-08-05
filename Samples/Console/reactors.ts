// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { reactor, EventContext, EventForEventSourceId, IEventStore } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeeEmailSet, EmployeePromoted, EmployeeMoved, PromotionRecorded } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/HrNotificationReactor' });

/** The event source the reactor's promotion side effect is appended to — shared across all employees. */
export const HR_AUDIT_LOG_EVENT_SOURCE_ID = 'hr-audit-log';

/**
 * Reacts to employee lifecycle events by emitting console notifications.
 *
 * Reactors are the "if this then that" mechanism of event sourcing: they observe
 * events and produce side effects such as sending emails, triggering commands in
 * other bounded contexts, or calling external APIs.
 *
 * Key rules:
 * - Methods must be idempotent — the reactor may be called more than once for the same event.
 * - Never query state inside a reactor; use the event data directly.
 * - Inject dependencies via constructor; never store mutable state on the class.
 */
@reactor()
export class HrNotificationReactor {
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> {
        logger.info('Employee hired', { name: `${event.firstName} ${event.lastName}`, title: event.title, sequenceNumber: context.sequenceNumber });
    }

    async employeeAddressSet(event: EmployeeAddressSet, context: EventContext): Promise<void> {
        logger.info('Employee address set', { city: event.city, country: event.country, sequenceNumber: context.sequenceNumber });
    }

    async employeeEmailSet(event: EmployeeEmailSet, context: EventContext): Promise<void> {
        logger.info('Employee email set', { email: event.email, sequenceNumber: context.sequenceNumber });
    }

    /**
     * Reacts to a promotion by recording it in the shared HR audit trail — a
     * cross-stream side effect, rather than just a log line.
     *
     * A reactor handler can return a single event, an array of events, a single
     * {@link EventForEventSourceId} (to target a different event source than the one
     * that triggered the reactor), an array of those, or a mix. Whatever is returned is
     * appended in one atomic `AppendMany` call once the handler completes; returning
     * nothing (or `Promise<void>`, as every other handler in this class still does)
     * keeps the previous "just observe" behavior. If the side-effect append fails, the
     * reactor's partition is marked Failed, exactly as if the handler itself had thrown.
     *
     * The audit event targets {@link HR_AUDIT_LOG_EVENT_SOURCE_ID} rather than the
     * promoted employee's own event source, so it must be returned as an
     * {@link EventForEventSourceId} wrapper with an explicit target — a bare returned
     * event would default to the triggering event's own event source/stream/subject.
     */
    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<EventForEventSourceId> {
        logger.info('Employee promoted', { newTitle: event.newTitle, sequenceNumber: context.sequenceNumber });

        return {
            eventSourceId: HR_AUDIT_LOG_EVENT_SOURCE_ID,
            event: new PromotionRecorded(context.eventSourceId, event.newTitle)
        };
    }

    async employeeMoved(event: EmployeeMoved, context: EventContext): Promise<void> {
        logger.info('Employee relocated', { city: event.city, country: event.country, sequenceNumber: context.sequenceNumber });
    }
}

/**
 * Prints every {@link PromotionRecorded} event appended so far to the shared HR audit
 * trail — the side effect {@link HrNotificationReactor.employeePromoted} appends to a
 * stream separate from any individual employee's own event source.
 *
 * @param store - The event store to read the audit trail from.
 */
export async function viewAuditLog(store: IEventStore): Promise<void> {
    const entries = await store.eventLog.getForEventSourceIdAndEventTypes(HR_AUDIT_LOG_EVENT_SOURCE_ID, [PromotionRecorded]);
    if (entries.length === 0) {
        console.log('[audit-log] No promotions recorded yet. Press \'P\' to promote someone first.');
        return;
    }

    console.log(`[audit-log] HR audit trail — ${entries.length} promotion(s) recorded via reactor side effect:`);
    for (const entry of entries) {
        const audit = entry.content as { employeeId: string; newTitle: string };
        console.log(`  [seq ${entry.context.sequenceNumber}] employee ${audit.employeeId} -> '${audit.newTitle}'`);
    }
}

