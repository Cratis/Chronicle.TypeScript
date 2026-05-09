// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';

/**
 * Defines a provider capable of returning discovered client artifact types.
 */
export interface IClientArtifactsProvider {
    /** Gets discovered event type constructors. */
    readonly eventTypes: Constructor[];

    /** Gets discovered read model constructors. */
    readonly readModels: Constructor[];

    /** Gets discovered reactor constructors. */
    readonly reactors: Constructor[];

    /** Gets discovered reducer constructors. */
    readonly reducers: Constructor[];

    /** Gets discovered constraint constructors. */
    readonly constraints: Constructor[];

    /** Gets discovered declarative projection constructors. */
    readonly projections: Constructor[];

    /** Gets discovered model-bound projection constructors. */
    readonly modelBoundProjections: Constructor[];
}
