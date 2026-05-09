// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { FromEventOptions } from './FromEventOptions';

/** Metadata stored by the fromEvent decorator on a class. */
export interface FromEventMetadata extends FromEventOptions {
    /** The event constructor associated with this annotation. */
    readonly eventType: Function;
}
