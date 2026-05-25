// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IReadModelPropertiesBuilder } from './IReadModelPropertiesBuilder';

/**
 * Defines the builder for configuring property mappings from a specific event type.
 * @template TReadModel - The read model type.
 * @template TEvent - The event type.
 */
export interface IFromBuilder<TReadModel, TEvent>
    extends IReadModelPropertiesBuilder<TReadModel, TEvent, IFromBuilder<TReadModel, TEvent>> {}
