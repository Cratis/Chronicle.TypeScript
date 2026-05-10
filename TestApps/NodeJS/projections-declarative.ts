// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventStore, IProjectionBuilderFor, IProjectionFor, projection, readModel } from '@cratis/chronicle';
import { EmployeeHired, EmployeeMoved, EmployeePromoted } from './events';
import { Guid } from '@cratis/fundamentals';

/** Read model shape for the declarative employee list projection artifact. */
@readModel()
export class Employee {
    id: Guid = Guid.empty;
    fullName: string = '';
    title: string = '';
    city: string = '';
}

/**
 * Declarative projection artifact discovered by the TypeScript client.
 */
@projection()
export class EmployeeListProjection implements IProjectionFor<Employee> {
    /** @inheritdoc */
    define(builder: IProjectionBuilderFor<Employee>): void {
        builder
            .from(EmployeeHired, fb => fb
                .set(m => m.fullName).to(e => e.firstName)
                .set(m => m.title).to(e => e.title)
            )
            .from(EmployeePromoted, fb => fb
                .set(m => m.title).to(e => e.newTitle)
            )
            .from(EmployeeMoved, fb => fb
                .set(m => m.city).to(e => e.newCity)
            );
    }
}

/**
 * Registers the declarative employee list projection with the given event store.
 * @param store - The event store to register the projection with.
 */
export async function registerEmployeeListProjection(store: IEventStore): Promise<void> {
    await store.projections.register();
    console.log('  Declarative projection "EmployeeListProjection" registered via builder API.');
}


