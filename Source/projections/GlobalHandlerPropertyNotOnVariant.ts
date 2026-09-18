// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Error thrown when a globalFor shared handler declares a mapping that targets a member a
 * variant it applies to does not have.
 */
export class GlobalHandlerPropertyNotOnVariant extends Error {
    /**
     * Creates a new {@link GlobalHandlerPropertyNotOnVariant}.
     * @param globalHandlerName - The name of the shared handler type.
     * @param variantName - The name of the variant type missing the property.
     * @param propertyName - The property name the shared handler mapped to.
     */
    constructor(globalHandlerName: string, variantName: string, propertyName: string) {
        super(`Shared handler '${globalHandlerName}' maps to property '${propertyName}', which does not exist on variant '${variantName}'.`);
        this.name = 'GlobalHandlerPropertyNotOnVariant';
    }
}
