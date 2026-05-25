// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IEventSeedingBuilder } from './IEventSeedingBuilder';

/**
 * Defines a system that can seed events into the event store.
 */
export interface ICanSeedEvents {
    /**
     * Seeds events into the event store.
     * @param builder - The event seeding builder to use.
     */
    seed(builder: IEventSeedingBuilder): void | Promise<void>;
}
