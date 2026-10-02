// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ContractEventType } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { CheckMapping, RejectOperation } from './ProjectionChildrenCapabilities.js';

/** Schema checks shared with the root projection capability validator. */
export interface ProjectionJoinValidationContext {
    readonly schema: JsonSchema;
    readonly requireEventSchema: (eventType: ContractEventType, path: string) => JsonSchema;
    readonly checkMapping: CheckMapping;
    readonly checkProtection: (schema: JsonSchema, path: string) => void;
    readonly reject: RejectOperation;
}
