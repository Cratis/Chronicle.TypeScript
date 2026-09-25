// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Fields, type Constructor } from '@cratis/fundamentals';
import type { IClientArtifactsProvider } from '../artifacts/IClientArtifactsProvider.js';
import { getProjectionMetadata } from '../projections/declarative/projection.js';
import { getChildrenFromMetadata } from '../projections/modelBound/childrenFrom.js';
import { isNested } from '../projections/modelBound/nested.js';
import { getReducerMetadata } from '../reducers/reducer.js';
import { TypeIntrospector } from '../types/TypeIntrospector.js';

/** Excludes models used as children or nested objects from root projection registration. */
export function rootReadModelTypes(artifacts: IClientArtifactsProvider): Constructor[] {
    const models = artifacts.readModels;
    const usedAsChildren = new Set<Function>();
    const visited = new Set<Function>();
    const inspect = (type: Function): void => {
        if (visited.has(type)) return;
        visited.add(type);
        const fields = Fields.getFieldsForType(type as Constructor);
        for (const property of TypeIntrospector.getTrackedProperties(type)) {
            const child = getChildrenFromMetadata(type.prototype, property).length > 0;
            const nested = isNested(type.prototype, property);
            if (!child && !nested) continue;
            const field = fields.find(candidate => candidate.name === property);
            const referenced = child ? field?.genericArguments?.[0] :
                (field?.type && field.type !== Object ? field.type : Reflect.getMetadata('design:type', type.prototype, property) as Function | undefined);
            if (referenced && referenced !== Array && referenced !== Object) {
                usedAsChildren.add(referenced);
                inspect(referenced);
            }
        }
    };
    for (const type of models) inspect(type);
    for (const type of artifacts.projections) {
        const model = getProjectionMetadata(type)?.readModelType;
        if (model) inspect(model);
    }
    for (const type of artifacts.reducers) {
        const model = getReducerMetadata(type)?.readModel;
        if (model) inspect(model);
    }
    return models.filter(type => !usedAsChildren.has(type));
}
