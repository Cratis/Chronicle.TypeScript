// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ProjectionId } from './ProjectionId.js';

/** Metadata resolved during model-bound projection discovery. */
export interface ResolvedModelBoundMetadata {
    id: ProjectionId;
    eventSequenceId: string | undefined;
    readModelIdentifier: string;
}
