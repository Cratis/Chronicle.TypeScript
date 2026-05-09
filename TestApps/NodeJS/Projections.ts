// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { projection, IProjectionFor, IProjectionBuilderFor } from '@cratis/chronicle';
import { EmployeeReadModel } from './ReadModels';
import { EmployeeHired, EmployeeLeft, EmployeeMoved, EmployeePromoted } from './Events';

/**
 * Declarative projection that builds an EmployeeReadModel from employee domain events.
 * Uses the fluent builder API to describe all property mappings explicitly.
 */
@projection('employees-declarative')
export class EmployeesDeclarativeProjection implements IProjectionFor<EmployeeReadModel> {
    /** @inheritdoc */
    define(builder: IProjectionBuilderFor<EmployeeReadModel>): void {
        builder
            .from<EmployeeHired>(fromBuilder =>
                fromBuilder
                    .set(m => m.firstName).to(e => e.firstName)
                    .set(m => m.lastName).to(e => e.lastName)
                    .set(m => m.title).to(e => e.title)
            )
            .from<EmployeePromoted>(fromBuilder =>
                fromBuilder
                    .set(m => m.title).to(e => e.newTitle)
                    .increment(m => m.promotionCount)
            )
            .from<EmployeeMoved>(fromBuilder =>
                fromBuilder
                    .set(m => m.city).to(e => e.newCity)
            )
            .removedWith<EmployeeLeft>();
    }
}
