// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { IClientArtifactsProvider } from '../../artifacts/index.js';
import { getEventTypeFor } from '../eventTypeDecorator.js';
import { getEventTypeMigrationMetadata } from './eventTypeMigration.js';
import { IEventTypeMigrators } from './IEventTypeMigrators.js';

/**
 * Represents an implementation of {@link IEventTypeMigrators}.
 */
export class EventTypeMigrators implements IEventTypeMigrators {
    private readonly _migratorsByEventType = new Map<string, Constructor[]>();

    /**
     * Initializes a new instance of the {@link EventTypeMigrators} class.
     * @param _clientArtifacts - The client artifact provider used to discover migrators.
     */
    constructor(private readonly _clientArtifacts: IClientArtifactsProvider) {}

    /** @inheritdoc */
    get allMigrators(): Constructor[] {
        return this._clientArtifacts.eventTypeMigrations;
    }

    /** @inheritdoc */
    getMigratorsFor(eventType: Constructor): Constructor[] {
        const key = this.getEventTypeKey(eventType);
        const cached = this._migratorsByEventType.get(key);
        if (cached) {
            return cached;
        }

        const migrators = this._clientArtifacts.eventTypeMigrations
            .filter(migratorType => {
                const metadata = getEventTypeMigrationMetadata(migratorType);
                return metadata?.eventType.toString() === key;
            });

        this._migratorsByEventType.set(key, migrators);
        return migrators;
    }

    private getEventTypeKey(eventType: Constructor): string {
        return getEventTypeFor(eventType).toString();
    }
}
