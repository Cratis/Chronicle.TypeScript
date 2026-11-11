// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { ProjectionCapabilityReject } from './ProjectionCapabilityReject.js';
import { ProjectionSchemaCapabilities } from './ProjectionSchemaCapabilities.js';

/** Registered read-model evidence and sink-managed identifier requirements. */
export class ProjectionReadModelCapabilities {
    static schema(compiled: CompiledProjectionDefinitions, model: string, reject: ProjectionCapabilityReject): JsonSchema {
        const readModel = compiled.readModels.find(candidate => candidate.Type.Identifier === model)
            ?? reject('ReadModel', 'a single registered read-model schema is required');
        let schema: JsonSchema;
        try { schema = JSON.parse(readModel.Schema) as JsonSchema; }
        catch { reject('ReadModel.Schema', 'read-model schema is not valid JSON'); }
        ProjectionSchemaCapabilities.checkProtection(schema!, 'ReadModel.Schema', reject);
        this.identifier(schema!.properties?.id, reject);
        this.collisions(schema!, reject);
        return schema!;
    }

    private static identifier(identifier: JsonSchema | undefined, reject: ProjectionCapabilityReject): void {
        if (!identifier || !this.supportedIdentifier(identifier)) {
            reject('ReadModel.Schema.id', 'only a lowercase id with a fixture-backed string, GUID, or number/double schema is supported; other identifiers require a kernel-backed test (ChronicleKernelScenario / live kernel)');
        }
    }

    private static supportedIdentifier(identifier: JsonSchema): boolean {
        if (identifier.type === 'string') return !identifier.format || identifier.format === 'guid';
        return identifier.type === 'number' && identifier.format === 'double';
    }

    private static collisions(schema: JsonSchema, reject: ProjectionCapabilityReject): void {
        const names = Object.keys(schema.properties ?? {});
        for (const [index, name] of names.entries()) {
            if (names.slice(index + 1).some(other => other.toLowerCase() === name.toLowerCase())) {
                reject(`ReadModel.Schema.${name}`, 'case-insensitively colliding read-model properties require a kernel-backed test (ChronicleKernelScenario / live kernel)');
            }
        }
    }
}
