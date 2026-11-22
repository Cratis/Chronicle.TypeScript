// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '../IEventStore.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** Truthful watch-delivery metadata, separate from event artifact activation. */
export interface ReadModelReactorActivationContext {
    readonly artifactId: string;
    readonly eventStore: IEventStore;
    readonly readModel: Constructor;
    readonly changeset: ReadModelChangeset<unknown>;
    readonly handlerName: string;
    readonly signal: AbortSignal;
}
