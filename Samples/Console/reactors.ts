// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import { reactor, EventContext } from '@cratis/chronicle';
import { EmployeeHired, EmployeeAddressSet, EmployeePromoted, EmployeeMoved } from './events';

const logger = diag.createComponentLogger({ namespace: 'chronicle-test-console/HrNotificationReactor' });

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

    async employeePromoted(event: EmployeePromoted, context: EventContext): Promise<void> {
        logger.info('Employee promoted', { newTitle: event.newTitle, sequenceNumber: context.sequenceNumber });
    }

    async employeeMoved(event: EmployeeMoved, context: EventContext): Promise<void> {
        logger.info('Employee relocated', { city: event.city, country: event.country, sequenceNumber: context.sequenceNumber });
    }
}

