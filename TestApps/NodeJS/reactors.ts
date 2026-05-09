// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { reactor, EventContext } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

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
    /**
     * Reacts to a new employee being hired.
     * @param event - The EmployeeHired event.
     * @param context - The event context providing sequence number and metadata.
     */
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> {
        console.log(`  [Reactor] ${event.firstName} ${event.lastName} hired as ${event.title} (seq #${context.sequenceNumber})`);
    }

    /**
     * Reacts to an employee being promoted.
     * @param event - The EmployeePromoted event.
     * @param context - The event context.
     */
    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<void> {
        console.log(`  [Reactor] Employee promoted to ${event.newTitle} (seq #${context.sequenceNumber})`);
    }

    /**
     * Reacts to an employee relocating.
     * @param event - The EmployeeMoved event.
     * @param context - The event context.
     */
    async employeeMoved(event: EmployeeMoved, context: EventContext): Promise<void> {
        console.log(`  [Reactor] Employee relocated to ${event.newCity} (seq #${context.sequenceNumber})`);
    }
}
