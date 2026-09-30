// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from './ActivatedArtifact.js';
import type { ArtifactActivationContext } from './ArtifactActivationContext.js';

/** Creates a delivery-scoped reactor or reducer lease. Constructor dependencies are resolved by the caller. */
export type ClientArtifactsActivator = <T>(type: Constructor<T>, context: ArtifactActivationContext) =>
    ActivatedArtifact<T> | Promise<ActivatedArtifact<T>>;
