// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents a type of causation.
 */
export class CausationType {
    /**
     * Represents the root causation type.
     */
    static readonly root = new CausationType('Root');

    /**
     * Represents the unknown causation type.
     */
    static readonly unknown = new CausationType('Unknown');

    /**
     * Represents the causation type for a single event append via the TypeScript client.
     */
    static readonly appendEvent = new CausationType('TypeScriptClient.Append');

    /**
     * Represents the causation type for a batch event append via the TypeScript client.
     */
    static readonly appendManyEvents = new CausationType('TypeScriptClient.AppendMany');

    /**
     * Initializes a new instance of the {@link CausationType} class.
     * @param name - The name of the causation type.
     */
    constructor(readonly name: string) {}

    /** @inheritdoc */
    toString(): string {
        return this.name;
    }
}
