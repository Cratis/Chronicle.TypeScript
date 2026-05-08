// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { DecoratorType } from './DecoratorType';
import { DiscoverableType } from './DiscoverableType';

/**
 * Defines a provider capable of returning discovered client artifact types.
 */
export interface IClientArtifactsProvider {
    /**
     * Gets all discovered types for a decorator category.
     * @param decoratorType - The decorator category to retrieve types for.
     * @returns The discovered types.
     */
    getTypesByDecoratorType(decoratorType: DecoratorType): DiscoverableType[];
}
