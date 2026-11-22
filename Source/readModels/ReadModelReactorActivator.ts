// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import type { ReadModelReactorActivationContext } from './ReadModelReactorActivationContext.js';

/** Resolves dependencies and leases one reactor for each matching change. */
export type ReadModelReactorActivator = <T>(type: Constructor<T>, context: ReadModelReactorActivationContext) => ActivatedArtifact<T> | Promise<ActivatedArtifact<T>>;
