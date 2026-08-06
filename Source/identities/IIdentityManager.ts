// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines a manager of identities in the system.
 */
export interface IIdentityManager {
    /**
     * Renames the name of an identity, identified by its subject.
     * @param subject - The subject of the identity to rename.
     * @param name - The new name to give the identity.
     * @remarks
     * The subject is the stable identifier of the identity - the name is the display name and
     * can change over time, for instance when a person changes their name. Renaming an identity
     * affects every event and read model that refers to the identity, as the name is resolved
     * from the identity itself and not stored with what refers to it.
     */
    rename(subject: string, name: string): Promise<void>;
}
