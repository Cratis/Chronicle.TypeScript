// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fromEvent, IEventStore, readModel, setFrom } from '@cratis/chronicle';
import { EmployeeHired, EmployeePromoted, EmployeeMoved } from './events';
import { Guid } from '@cratis/fundamentals';

/**
 * Model-bound projection artifact discovered by the TypeScript client.
 *
 * Runtime model-bound projection execution is still under implementation in the
 * TypeScript client. This class represents an artifact declaration only.
 */
@readModel()
@fromEvent(EmployeeHired)
@fromEvent(EmployeePromoted)
@fromEvent(EmployeeMoved)
export class EmployeeDetails {
    id: Guid = Guid.empty;

    @setFrom(EmployeeHired)
    firstName = '';

    @setFrom(EmployeeHired)
    lastName = '';

    @setFrom(EmployeeHired)
    @setFrom(EmployeePromoted, 'newTitle')
    title = '';

    @setFrom(EmployeeMoved, 'newCity')
    city = '';
}

/**
 * Reports current model-bound projection support status in the TypeScript client.
 *
 * @param store - The event store.
 */
export async function demonstrateModelBoundProjection(store: IEventStore): Promise<void> {
    console.log('  Discovering and registering model-bound projection artifacts from @readModel + model-bound decorators...');
    await store.projections.discover();
    await store.projections.register();
    console.log(`  [Projection] Artifact   : ${EmployeeDetails.name}`);
    console.log('  [Projection] Discovery  : @fromEvent/@setFrom on @readModel');
    console.log('  [Projection] Status     : registered in kernel');
    void store;
}
