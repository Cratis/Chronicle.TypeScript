// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ICanSeedEvents, IEventSeedingBuilder, seeder } from '@cratis/chronicle';
import { EmployeeAddressSet, EmployeeEmailSet, EmployeeHired } from './events';
import { emailFor, employees } from './employees';

interface Address {
    readonly street: string;
    readonly city: string;
    readonly zipCode: string;
    readonly country: string;
}

const addresses: Address[] = [
    { street: '221B Baker Street',         city: 'London',        zipCode: 'NW1 6XE', country: 'UK'  },
    { street: '1600 Amphitheatre Parkway', city: 'Mountain View', zipCode: '94043',   country: 'USA' },
    { street: '1 Infinite Loop',           city: 'Cupertino',     zipCode: '95014',   country: 'USA' }
];

const titles = ['Software Engineer', 'Senior Engineer', 'Principal Engineer'];

@seeder()
export class EmployeeSeeder implements ICanSeedEvents {
    seed(builder: IEventSeedingBuilder): void {
        employees.forEach((person, index) => {
            const address = addresses[index % addresses.length];
            const title = titles[index % titles.length];
            builder.forEventSource(person.id, [
                new EmployeeHired(person.firstName, person.lastName, title),
                new EmployeeEmailSet(emailFor(person)),
                new EmployeeAddressSet(address.street, address.city, address.zipCode, address.country)
            ]);
        });
    }
}
