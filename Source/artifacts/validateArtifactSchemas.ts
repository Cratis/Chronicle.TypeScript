// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IClientArtifactsProvider } from './IClientArtifactsProvider.js';
import { getEventTypeMetadata } from '../events/eventTypeDecorator.js';
import { getReadModelMetadata } from '../readModels/readModel.js';
import { JsonSchemaGenerator } from '../schemas/JsonSchemaGenerator.js';

/** Resolves every discovered schema before any registration can reach the Kernel. */
export function validateArtifactSchemas(artifacts: IClientArtifactsProvider): void {
    const failures: Error[] = [];

    for (const type of artifacts.eventTypes) {
        try {
            const metadata = getEventTypeMetadata(type);
            if (!metadata) throw new TypeError(`Missing event type metadata for ${type.name}.`);
            void metadata.schema;
        } catch (error) {
            failures.push(new Error(`Event type ${type.name}: ${String(error)}`, { cause: error }));
        }
    }

    for (const type of artifacts.readModels) {
        try {
            const metadata = getReadModelMetadata(type);
            if (metadata) {
                void metadata.schema;
            } else {
                JsonSchemaGenerator.generate(type);
            }
        } catch (error) {
            failures.push(new Error(`Read model ${type.name}: ${String(error)}`, { cause: error }));
        }
    }

    if (failures.length) {
        throw new AggregateError(failures, `Cannot register artifacts: ${failures.length} schema error(s).`);
    }
}
