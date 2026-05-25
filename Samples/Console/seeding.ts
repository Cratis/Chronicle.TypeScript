// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';
import { EmployeeAddressSet, EmployeeHired } from './events';

const adaLovelaceId = 'a0000001-0000-0000-0000-000000000000';
const graceHopperId = 'a0000002-0000-0000-0000-000000000000';
const alanTuringId = 'a0000003-0000-0000-0000-000000000000';

@seeder()
export class EmployeeSeeder implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        builder
            .for<EmployeeHired>(adaLovelaceId, [
                new EmployeeHired('Ada', 'Lovelace', 'Software Engineer')
            ])
            .for<EmployeeHired>(alanTuringId, [
                new EmployeeHired('Alan', 'Turing', 'Architect')
            ])
            .forNamespace('Sales')
            .forEventSource(graceHopperId, [
                new EmployeeHired('Grace', 'Hopper', 'Principal Engineer'),
                new EmployeeAddressSet('1600 Amphitheatre Parkway', 'Mountain View', '94043', 'USA')
            ]);
    }
}
