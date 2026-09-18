// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a read model variant does not declare at least one entersOn event.
 */
export class VariantMustDeclareEntersOnEvent extends Error {
    /**
     * Creates a new {@link VariantMustDeclareEntersOnEvent}.
     * @param typeName - The name of the variant type missing an entersOn declaration.
     */
    constructor(typeName: string) {
        super(`Read model variant '${typeName}' does not declare an entersOn event. A variant must name at least one event that may create or resurrect it.`);
        this.name = 'VariantMustDeclareEntersOnEvent';
    }
}
