// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { type Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { InvalidEventContextPropertyError } from '../projections/InvalidEventContextPropertyError.js';
import { getReadModelId } from './readModel.js';
import { ProjectionBuilderFor } from '../projections/declarative/ProjectionBuilderFor.js';
import type { IProjectionFor } from '../projections/declarative/IProjectionFor.js';
import type { ChildrenDefinitionLike } from '../projections/modelBound/childrenAndNestedBuilder.js';
import { getChildrenFromMetadata } from '../projections/modelBound/childrenFrom.js';
import { resolveChildElementType, resolveNestedType } from '../projections/modelBound/childrenAndNestedBuilder.js';
import { isNested } from '../projections/modelBound/nested.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { TypeIntrospector } from '../types/TypeIntrospector.js';

function inspectReadModelTypes(artifacts: IClientArtifactsProvider): { models: Constructor[]; usedAsChildren: Set<Function>; visited: Set<Function> } {
    const models = artifacts.readModels;
    const usedAsChildren = new Set<Function>();
    const visited = new Set<Function>();
    const inspect = (type: Function): void => {
        if (visited.has(type)) return;
        visited.add(type);
        for (const property of TypeIntrospector.getTrackedProperties(type)) {
            const child = getChildrenFromMetadata(type.prototype, property).length > 0;
            const nested = isNested(type.prototype, property);
            if (!child && !nested) continue;
            const referenced = child ? resolveChildElementType(type, property) : resolveNestedType(type, property);
            if (referenced && referenced !== type && referenced !== Array && referenced !== Object) {
                usedAsChildren.add(referenced);
                inspect(referenced);
            }
        }
    };
    for (const type of models) inspect(type);
    const inspectDeclarative = (type: Function, definitions: { children: Record<string, ChildrenDefinitionLike>; nested: Record<string, ChildrenDefinitionLike> }): void => {
        for (const [property, definition] of Object.entries(definitions.children)) {
            const referenced = resolveChildElementType(type, property);
            if (!referenced) continue;
            if (referenced !== type) usedAsChildren.add(referenced);
            inspect(referenced);
            inspectDeclarative(referenced, { children: definition.Children, nested: definition.Nested });
        }
        for (const [property, definition] of Object.entries(definitions.nested)) {
            const referenced = resolveNestedType(type, property);
            if (!referenced) continue;
            if (referenced !== type) usedAsChildren.add(referenced);
            inspect(referenced);
            inspectDeclarative(referenced, { children: definition.Children, nested: definition.Nested });
        }
    };
    for (const type of artifacts.projections) {
        const model = getProjectionMetadata(type)?.readModelType;
        if (!model) continue;
        inspect(model);
        const builder = new ProjectionBuilderFor<unknown>();
        try {
            (new type() as IProjectionFor<unknown>).define(builder);
        } catch (error) {
            if (error instanceof InvalidEventContextPropertyError) {
                throw new Error(`Invalid event context property '${error.propertyPath}' in projection '${type.name}' (read model '${getReadModelId(model)}').`, { cause: error });
            }
            throw error;
        }
        inspectDeclarative(model, builder.getSubobjectDefinitions());
    }
    for (const type of artifacts.reducers) {
        const model = getReducerMetadata(type)?.readModel;
        if (model) inspect(model);
    }
    return { models, usedAsChildren, visited };
}

/** Excludes models used as children or nested objects from root projection registration. */
export function rootReadModelTypes(artifacts: IClientArtifactsProvider): Constructor[] {
    const { models, usedAsChildren } = inspectReadModelTypes(artifacts);
    return models.filter(type => !usedAsChildren.has(type));
}

/** Includes all read-model types reached from registered roots, including children and nested models. */
export function reachableReadModelTypes(artifacts: IClientArtifactsProvider): Function[] {
    return [...inspectReadModelTypes(artifacts).visited];
}
