// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { Constructor } from '@cratis/fundamentals';
import { EventSequenceId } from '../EventSequences/EventSequenceId';

/**
 * Defines a builder for webhook definitions.
 */
export interface IWebhookDefinitionBuilder {
    /**
     * Sets the event sequence for the webhook.
     * @param eventSequenceId - The event sequence identifier.
     * @returns The builder for chaining.
     */
    onEventSequence(eventSequenceId: EventSequenceId): IWebhookDefinitionBuilder;

    /**
     * Uses basic authorization for the webhook target.
     * @param username - Basic auth username.
     * @param password - Basic auth password.
     * @returns The builder for chaining.
     */
    withBasicAuth(username: string, password: string): IWebhookDefinitionBuilder;

    /**
     * Uses bearer token authorization for the webhook target.
     * @param token - Bearer token.
     * @returns The builder for chaining.
     */
    withBearerToken(token: string): IWebhookDefinitionBuilder;

    /**
     * Uses OAuth authorization for the webhook target.
     * @param authority - OAuth authority.
     * @param clientId - OAuth client id.
     * @param clientSecret - OAuth client secret.
     * @returns The builder for chaining.
     */
    withOAuth(authority: string, clientId: string, clientSecret: string): IWebhookDefinitionBuilder;

    /**
     * Adds a target header.
     * @param key - Header key.
     * @param value - Header value.
     * @returns The builder for chaining.
     */
    withHeader(key: string, value: string): IWebhookDefinitionBuilder;

    /**
     * Adds an event type by constructor.
     * @param eventType - Event type constructor.
     * @returns The builder for chaining.
     */
    withEventType(eventType: Constructor): IWebhookDefinitionBuilder;

    /**
     * Marks the webhook as not replayable.
     * @returns The builder for chaining.
     */
    notReplayable(): IWebhookDefinitionBuilder;

    /**
     * Marks the webhook as not active.
     * @returns The builder for chaining.
     */
    notActive(): IWebhookDefinitionBuilder;
}
