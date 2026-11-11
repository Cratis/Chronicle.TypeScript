// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { type AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import { ProjectionCapabilityReporter } from './ProjectionCapabilityReporter.js';
import { ProjectionChildrenCapabilities } from './ProjectionChildrenCapabilities.js';
import { ProjectionDefinitionCapabilities } from './ProjectionDefinitionCapabilities.js';
import { ProjectionEventSchemaResolver } from './ProjectionEventSchemaResolver.js';
import { ProjectionInitialValueCapabilities } from './ProjectionInitialValueCapabilities.js';
import { ProjectionJoinsCapabilities } from './ProjectionJoinsCapabilities.js';
import { ProjectionMappingCapabilities } from './ProjectionMappingCapabilities.js';
import { ProjectionReadModelCapabilities } from './ProjectionReadModelCapabilities.js';
import { ProjectionRootCapabilities } from './ProjectionRootCapabilities.js';
import { ProjectionSchemaCapabilities } from './ProjectionSchemaCapabilities.js';

/** Validates *all* subscribed operations against the bounded scenario subset, before replay. */
export class ProjectionCapabilities {
    /**
     * Throws with the original declaration and contract path for the first unsupported operation.
     * @param compiled - Definitions and their schema/provenance evidence.
     * @param definition - The compiled contract to validate.
     */
    static validate(compiled: CompiledProjectionDefinitions, definition: ProjectionDefinition): void {
        const model = String(definition.ReadModel ?? definition.Identifier ?? '<unknown>');
        const wire = definition as unknown as Record<string, unknown>;
        const reject = new ProjectionCapabilityReporter(compiled, definition).reject;
        if (!compiled.definitions.includes(definition)) reject('Definition', 'definition is not part of this compile');
        const provenance = compiled.provenance.get(definition) ?? reject('Definition', 'capability provenance is unavailable');
        const catalog = compiled.eventSchemas.get(definition) ?? reject('Definition', 'event-schema catalog is unavailable');
        ProjectionDefinitionCapabilities.validate(wire, provenance, reject);
        const schema = ProjectionReadModelCapabilities.schema(compiled, model, reject);
        const initial = ProjectionInitialValueCapabilities.validate(String(wire.InitialModelState ?? '{}'), schema, reject);
        const resolver = new ProjectionEventSchemaResolver(catalog, reject);
        ProjectionJoinsCapabilities.validate(definition, {
            schema, requireEventSchema: resolver.require, reject,
            checkProtection: (eventSchema, path) => ProjectionSchemaCapabilities.checkProtection(eventSchema, path, reject),
            checkMapping: (modelSchema, eventSchema, destination, expression, path) =>
                new ProjectionMappingCapabilities(modelSchema, reject).check({ eventSchema, destination, expression, path })
        });
        const roots = new ProjectionRootCapabilities(schema, wire, reject);
        roots.validate(resolver);
        ProjectionChildrenCapabilities.validate(wire.Children as Record<string, ChildrenDefinitionLike> ?? {}, {
            schema, rootAutoMap: wire.AutoMap as AutoMap, hasInitialModelState: Object.keys(initial).length > 0,
            from: roots.from, removedWith: roots.removedWith, requireEventSchema: resolver.require, reject,
            declarationFor: path => provenance.find(entry => entry.contractPath === path)?.declaration,
            checkMapping: (modelSchema, eventSchema, destination, expression, path) =>
                new ProjectionMappingCapabilities(modelSchema, reject).check({ eventSchema, destination, expression, path })
        });
    }
}
