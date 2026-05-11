// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Identity } from './Identity';

/**
 * Defines a system that can provide and manage the current {@link Identity} for the active call context.
 */
export interface IIdentityProvider {
    /**
     * Gets the current identity for the active call context.
     * @returns The current {@link Identity}, or {@link Identity.system} if none has been set.
     */
    getCurrent(): Identity;

    /**
     * Sets the current identity for the active call context.
     * @param identity - The {@link Identity} to set.
     */
    setCurrentIdentity(identity: Identity): void;

    /**
     * Clears the current identity for the active call context, resetting it to {@link Identity.system}.
     */
    clearCurrentIdentity(): void;
}
