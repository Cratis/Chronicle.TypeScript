// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { JsonSchema } from '../../schemas/JsonSchema.js';

/** One compiled mapping and the event schema it reads. */
export interface ProjectionMappingValidation {
    readonly eventSchema: JsonSchema;
    readonly destination: string;
    readonly expression: string;
    readonly path: string;
}
