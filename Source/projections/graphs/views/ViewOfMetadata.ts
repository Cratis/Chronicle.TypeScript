// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Metadata stored by the viewOf class decorator. */
export interface ViewOfMetadata {
    /** A function returning the class of the node the view is anchored at. */
    readonly root: () => Function;

    /** The name of the view. */
    readonly name: string;
}
