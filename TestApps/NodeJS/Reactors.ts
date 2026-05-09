// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { reactor, EventContext } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted } from './Events';

/** Reacts to employee events by logging them to the console. */
@reactor('hr-notification-reactor')
export class HrNotificationReactor {
    /**
     * Reacts to an employee being hired.
     * @param event - The EmployeeHired event.
     * @param context - The event context.
     */
    async employeeHired(event: EmployeeHired, context: EventContext): Promise<void> {
        console.log(`[Reactor] ${event.firstName} ${event.lastName} was hired as ${event.title} (seq: ${context.sequenceNumber})`);
    }

    /**
     * Reacts to an employee being promoted.
     * @param event - The EmployeePromoted event.
     * @param context - The event context.
     */
    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<void> {
        console.log(`[Reactor] Promotion to ${event.newTitle} (seq: ${context.sequenceNumber})`);
    }
}
