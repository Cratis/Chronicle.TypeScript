// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { causationManager } from '../auditing/index.js';

/**
 * Converts a causation chain into the Causation shape used by Chronicle contracts.
 * @param causationChain - The causation chain to convert.
 * @returns The contracts causation entries.
 */
export function toContractsCausation(causationChain: ReturnType<typeof causationManager.getCurrentChain>) {
    return causationChain.map(c => ({
        Occurred: { Value: c.occurred.toISOString() },
        Type: c.type.name,
        Properties: { ...c.properties }
    }));
}
