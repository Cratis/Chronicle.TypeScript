// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import type { IEventStore } from '../IEventStore.js';
import type { ReadModelChangeset } from './ReadModelChangeset.js';

/** Return true only when the application has fully handled the result; false uses explicit event routing. */
export type ReadModelReactorResultHandler = (result: unknown, changeset: ReadModelChangeset<unknown>, reactorType: Constructor,
    eventStore: IEventStore, namespace: string) => boolean | Promise<boolean>;
