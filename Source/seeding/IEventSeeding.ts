// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventSeedingBuilder } from './IEventSeedingBuilder';

/**
 * Defines the event seeding API surface.
 */
export interface IEventSeeding extends IEventSeedingBuilder {
    /**
     * Discovers all registered event seeders.
     * @returns A promise that resolves when discovery is complete.
     */
    discover(): Promise<void>;

    /**
     * Registers all discovered event seeders by invoking them and sending seed data to the server.
     * @returns A promise that resolves when registration is complete.
     */
    register(): Promise<void>;
}
