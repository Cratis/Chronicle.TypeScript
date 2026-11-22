// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { IReactorBuilder } from './IReactorBuilder.js';
import type { IReactorDefinitionBuilder } from './IReactorDefinitionBuilder.js';
import type { IReactorDefinition } from './IReactorDefinition.js';
import type { ReactorId } from './ReactorId.js';
import type { WaitTillSubscribedOptions } from './WaitTillSubscribedOptions.js';

/** Manages reactor identities and their local observations for one event store and namespace. */
export interface IReactors {
    /** Discovers artifacts, rejecting duplicate IDs before any stream is opened. */
    discover(): Promise<void>;

    /** Creates an immutable definition without registering or observing it. */
    define(id: ReactorId | string, define: (builder: IReactorBuilder) => void): IReactorDefinition;

    /** Starts local observation for discovered and retained runtime definitions. Idempotent while active. */
    register(): Promise<void>;
    /** Resolves after local validation, reservation and observation start, not a kernel acknowledgment. */
    register(definition: IReactorDefinition): Promise<void>;
    register(id: ReactorId | string, define: (builder: IReactorBuilder) => void): Promise<void>;
    /** The callback receives the envelope and the observation's cancellation signal. */
    register(id: ReactorId | string, configure: (builder: IReactorDefinitionBuilder) => void, handle: IReactorDefinition['handle']): Promise<void>;

    /** Removes local restoration eligibility and cancels observation; does not wait for in-flight callbacks. */
    unregister(id: ReactorId | string): Promise<void>;

    /**
     * Polls observer information until IsSubscribed, independently of registration.
     * This is not a causal acknowledgment of a particular register call and may observe an existing subscription.
     */
    waitTillSubscribed(id: ReactorId | string, options?: WaitTillSubscribedOptions): Promise<void>;
}
