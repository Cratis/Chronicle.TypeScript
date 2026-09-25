// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents the kind of observer an {@link ObserverInformation} describes.
 */
export enum ObserverType {
    /** The type of the observer is not known. */
    Unknown = 'Unknown',

    /** The observer is a reactor. */
    Reactor = 'Reactor',

    /** The observer is a projection. */
    Projection = 'Projection',

    /** The observer is a reducer. */
    Reducer = 'Reducer',

    /** The observer is driven by something outside Chronicle. */
    External = 'External'
}
