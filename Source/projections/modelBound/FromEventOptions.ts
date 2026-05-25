// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Options for the fromEvent class decorator. */
export interface FromEventOptions {
    /** The event property name to use as the key to identify the read model instance. */
    readonly key?: string;
    /** The event property name to use as the parent key for child relationships. */
    readonly parentKey?: string;
    /** A constant string value to use as the key. All events will update the same instance. */
    readonly constantKey?: string;
}
