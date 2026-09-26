// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A declaration and the contract path it produced, captured before variant lowering. */
export interface ProjectionCapabilityProvenance {
    readonly contractPath: string;
    readonly declaration: string;
}
