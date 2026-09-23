// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Defines the identity an `@encrypted()` value's encryption key is provisioned under.
 *
 * `@pii()` never gains any scope beyond {@link EncryptionScope.Subject} - GDPR compliance is always
 * resolved against a compliance identity, and widening that would make the compliance subject
 * boundary itself scope-dependent. `EncryptionScope` exists precisely because `@encrypted()` values
 * have no data subject and no erasure obligation, so a wider key boundary is safe for them in a way
 * it is not for PII.
 */
export enum EncryptionScope {
    /**
     * The key is provisioned per compliance identity (the same identity - subject or, when none is
     * set, event source id - PII values on the same document resolve to), and is looked up the same
     * way. This is the default.
     */
    Subject = 0,

    /**
     * The key is provisioned once per event store namespace, independent of any document's subject
     * or compliance identity. Every `@encrypted(EncryptionScope.Namespace)` value in a namespace
     * shares one key.
     */
    Namespace = 1,

    /**
     * The key is provisioned once for the whole Chronicle installation, independent of event store,
     * namespace, or compliance identity. Every `@encrypted(EncryptionScope.Global)` value across
     * every event store and namespace shares one key.
     */
    Global = 2
}
