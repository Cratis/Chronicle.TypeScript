// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Represents an identity of something that is responsible for causing a state change.
 * An identity can be a user, a system, a service or anything else that can be identified.
 */
export class Identity {
    /**
     * The identity used when not set.
     */
    static readonly notSet = new Identity('1efc9b81-0612-4466-962c-86acc4e9a028', '[Not Set]', '[Not Set]');

    /**
     * The identity used when the identity is not known.
     */
    static readonly unknown = new Identity('3321cf62-db16-425e-8173-99fcfefe11dd', '[Unknown]', '[Unknown]');

    /**
     * The identity used when the system is the cause.
     */
    static readonly system = new Identity('5d032c92-9d5e-41eb-947a-ee5314ed0032', '[System]', '[System]');

    /**
     * Initializes a new instance of the {@link Identity} class.
     * @param subject - The identifier of the identity, referred to as subject.
     * @param name - Name of the identity.
     * @param userName - Optional username, defaults to empty string.
     * @param onBehalfOf - Optional behalf of {@link Identity}.
     */
    constructor(
        readonly subject: string,
        readonly name: string,
        readonly userName: string = '',
        readonly onBehalfOf?: Identity
    ) {}

    /**
     * Returns a new {@link Identity} chain with duplicate subjects removed.
     * The first occurrence of each subject is kept.
     * @returns A new {@link Identity} with duplicates removed from the chain.
     */
    withoutDuplicates(): Identity {
        const seen = new Set<string>();
        const chain: Identity[] = [];
        let current: Identity | undefined = this;
        while (current !== undefined) {
            if (!seen.has(current.subject)) {
                seen.add(current.subject);
                chain.push(current);
            }
            current = current.onBehalfOf;
        }

        let result: Identity | undefined;
        for (let i = chain.length - 1; i >= 0; i--) {
            result = new Identity(chain[i].subject, chain[i].name, chain[i].userName, result);
        }
        return result!;
    }
}
