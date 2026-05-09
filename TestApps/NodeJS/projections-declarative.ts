// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, ProjectionDefinition } from '@cratis/chronicle.contracts';
import { getEventTypeFor, IEventStore } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';

/** Read model produced by the declarative employee list projection. */
export interface EmployeeListItem {
    readonly employeeId: string;
    readonly fullName: string;
    readonly title: string;
    readonly city: string;
}

/**
 * Declarative projection that builds an {@link EmployeeListItem} for every employee
 * from the employee lifecycle events.
 *
 * Declarative projections are defined as plain data structures and registered with
 * the Chronicle Kernel, which evaluates them server-side. They are best suited for
 * straightforward property mappings and list-style read models.
 *
 * Property mappings follow the shape `{ SourceProperty: 'targetProperty' }`.
 * AutoMap.Enabled lets the Kernel auto-map same-name properties; AutoMap.Disabled
 * requires all mappings to be stated explicitly.
 */
function buildEmployeeListProjection(): ProjectionDefinition {
    const hiredType = getEventTypeFor(EmployeeHired);
    const promotedType = getEventTypeFor(EmployeePromoted);
    const movedType = getEventTypeFor(EmployeeMoved);

    return {
        Identifier: 'b1c4d2e3-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        ReadModel: 'EmployeeListItem',
        EventSequenceId: '00000000-0000-0000-0000-000000000000',
        IsActive: true,
        IsRewindable: true,
        InitialModelState: JSON.stringify({ employeeId: '', fullName: '', title: '', city: '' }),
        AutoMap: AutoMap.Disabled,

        // Map each relevant event type to the model properties it contributes.
        // KeyValuePairEventTypeFromDefinition: Key = event type, Value = property mappings.
        From: [
            {
                Key: { Id: hiredType.id.value, Generation: hiredType.generation.value, Tombstone: false },
                Value: {
                    Properties: { fullName: 'firstName + " " + lastName', title: 'title' },
                    Key: '$eventSourceId',
                    ParentKey: ''
                }
            },
            {
                Key: { Id: promotedType.id.value, Generation: promotedType.generation.value, Tombstone: false },
                Value: {
                    Properties: { title: 'newTitle' },
                    Key: '$eventSourceId',
                    ParentKey: ''
                }
            },
            {
                Key: { Id: movedType.id.value, Generation: movedType.generation.value, Tombstone: false },
                Value: {
                    Properties: { city: 'newCity' },
                    Key: '$eventSourceId',
                    ParentKey: ''
                }
            }
        ],

        Join: [],
        Children: {},
        Nested: {},
        FromEvery: [],
        All: undefined,
        FromEventProperty: undefined,
        RemovedWith: [],
        RemovedWithJoin: [],
        LastUpdated: undefined,
        Tags: []
    };
}

export const employeeListProjection = buildEmployeeListProjection();

/**
 * Registers the declarative employee list projection with the Chronicle Kernel.
 *
 * The Kernel evaluates the projection server-side and maintains the read model in
 * its read model store. Clients query the read model store to retrieve the current
 * state of any projection.
 *
 * @param store - The event store to register the projection against.
 */
export async function registerEmployeeListProjection(store: IEventStore): Promise<void> {
    console.log('  Registering declarative employee list projection...');
    // The projection registration API is not yet available on the TypeScript client.
    // When available it will look like:
    //   await store.projections.register(employeeListProjection);
    console.log(`  [Projection] Read model  : ${employeeListProjection.ReadModel}`);
    console.log(`  [Projection] Identifier  : ${employeeListProjection.Identifier}`);
    console.log(`  [Projection] Event types : ${employeeListProjection.From.length}`);
    void store;
}
