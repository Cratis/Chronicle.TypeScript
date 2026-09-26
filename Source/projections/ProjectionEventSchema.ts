// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../schemas/JsonSchema.js';
import type { ContractEventType } from './declarative/ProjectionBuilderCore.js';

/** Schema registered for one participating event type and generation. */
export interface ProjectionEventSchema {
    readonly eventType: ContractEventType;
    readonly schema: JsonSchema;
}
