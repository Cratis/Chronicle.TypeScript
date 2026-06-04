// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A person that can be hired as an employee. */
export interface Person {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
}

/** The employees the sample operates on, shared between seeding and the interactive console. */
export const employees: Person[] = [
    { id: 'a0000001-0000-0000-0000-000000000000', firstName: 'Ada',   lastName: 'Lovelace' },
    { id: 'a0000002-0000-0000-0000-000000000000', firstName: 'Grace', lastName: 'Hopper'   },
    { id: 'a0000003-0000-0000-0000-000000000000', firstName: 'Alan',  lastName: 'Turing'   }
];

/** Builds the canonical, unique email address for a person (e.g. ada.lovelace@cratis.io). */
export const emailFor = (person: Person): string =>
    `${person.firstName}.${person.lastName}@cratis.io`.toLowerCase();
