// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';

/** An event type a batch method observes. */
export interface ObservedEventType {
    /** The event constructor. */
    readonly type: Constructor;

    /** The event type identifier. */
    readonly id: string;

    /** The event type generation. */
    readonly generation: number;
}
