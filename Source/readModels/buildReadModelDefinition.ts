// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReadModelObserverType } from '@cratis/chronicle.contracts';
import { Guid } from '@cratis/fundamentals';
import { toContractsGuid } from '../connection/Guid.js';
import { getIndexesForType } from './indexDecorator.js';

interface ReadModelDefinitionOptions {
    identifier: string;
    schema: string;
    type?: Function;
    sinkTypeId: string;
    observerType: ReadModelObserverType;
    observerIdentifier: string;
}

/** Builds the registration payload shared by projections, reducers, and direct read-model registration. */
export function buildReadModelDefinition(options: ReadModelDefinitionOptions) {
    return {
        Type: {
            Identifier: options.identifier,
            Generation: 1
        },
        ContainerName: options.identifier,
        DisplayName: options.identifier,
        Sink: {
            ConfigurationId: toContractsGuid(Guid.empty),
            TypeId: options.sinkTypeId
        },
        Schema: options.schema,
        Indexes: options.type ? getIndexesForType(options.type) : [],
        ObserverType: options.observerType,
        ObserverIdentifier: options.observerIdentifier,
        Owner: 1,
        Source: 1
    };
}
