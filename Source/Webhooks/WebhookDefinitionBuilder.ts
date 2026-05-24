// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type {
    BasicAuthorization,
    BearerTokenAuthorization,
    OAuthAuthorization,
    OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization,
    WebhookDefinition
} from '@cratis/chronicle.contracts';
import { Constructor } from '@cratis/fundamentals';
import { IEventTypes } from '../Events/IEventTypes';
import { getEventTypeFor } from '../Events/eventTypeDecorator';
import { EventSequenceId } from '../EventSequences/EventSequenceId';
import { IWebhookDefinitionBuilder } from './IWebhookDefinitionBuilder';
import { WebhookId } from './WebhookId';
import { WebhookTargetUrl } from './WebhookTargetUrl';

/**
 * Implements {@link IWebhookDefinitionBuilder}.
 */
export class WebhookDefinitionBuilder implements IWebhookDefinitionBuilder {
    private readonly _eventTypes = new Set<Constructor>();
    private readonly _headers = new Map<string, string>();
    private _eventSequenceId = EventSequenceId.eventLog.value;
    private _authorization: OneOfBasicAuthorizationBearerTokenAuthorizationOAuthAuthorization | undefined;
    private _isReplayable = true;
    private _isActive = true;

    /**
     * Creates a new builder.
     * @param _registeredEventTypes - Registered event types.
     */
    constructor(private readonly _registeredEventTypes: IEventTypes) {}

    /** @inheritdoc */
    onEventSequence(eventSequenceId: EventSequenceId): IWebhookDefinitionBuilder {
        this._eventSequenceId = eventSequenceId.value;
        return this;
    }

    /** @inheritdoc */
    withBasicAuth(username: string, password: string): IWebhookDefinitionBuilder {
        const value: BasicAuthorization = {
            Username: username,
            Password: password
        };
        this._authorization = {
            Value0: value,
            Value1: undefined,
            Value2: undefined
        };
        return this;
    }

    /** @inheritdoc */
    withBearerToken(token: string): IWebhookDefinitionBuilder {
        const value: BearerTokenAuthorization = { Token: token };
        this._authorization = {
            Value0: undefined,
            Value1: value,
            Value2: undefined
        };
        return this;
    }

    /** @inheritdoc */
    withOAuth(authority: string, clientId: string, clientSecret: string): IWebhookDefinitionBuilder {
        const value: OAuthAuthorization = {
            Authority: authority,
            ClientId: clientId,
            ClientSecret: clientSecret
        };
        this._authorization = {
            Value0: undefined,
            Value1: undefined,
            Value2: value
        };
        return this;
    }

    /** @inheritdoc */
    withHeader(key: string, value: string): IWebhookDefinitionBuilder {
        this._headers.set(key, value);
        return this;
    }

    /** @inheritdoc */
    withEventType(eventType: Constructor): IWebhookDefinitionBuilder {
        this._eventTypes.add(eventType);
        return this;
    }

    /** @inheritdoc */
    notReplayable(): IWebhookDefinitionBuilder {
        this._isReplayable = false;
        return this;
    }

    /** @inheritdoc */
    notActive(): IWebhookDefinitionBuilder {
        this._isActive = false;
        return this;
    }

    /**
     * Builds a webhook definition.
     * @param id - Webhook identifier.
     * @param targetUrl - Webhook target URL.
     * @returns A contract webhook definition.
     */
    build(id: WebhookId, targetUrl: WebhookTargetUrl): WebhookDefinition {
        if (!targetUrl.value) {
            throw new Error(`Webhook '${id.value}' is missing target URL.`);
        }

        const eventTypes = [...(this._eventTypes.size > 0 ? this._eventTypes : this._registeredEventTypes.all)].map(type => {
            const metadata = getEventTypeFor(type);
            if (!metadata) {
                throw new Error(`Event type '${type.name}' is missing @eventType metadata.`);
            }
            return {
                Id: metadata.id.value,
                Generation: metadata.generation.value,
                Tombstone: false
            };
        });

        return {
            EventSequenceId: this._eventSequenceId,
            Identifier: id.value,
            EventTypes: eventTypes,
            Target: {
                Url: targetUrl.value,
                Authorization: this._authorization,
                Headers: Object.fromEntries(this._headers)
            },
            IsReplayable: this._isReplayable,
            IsActive: this._isActive
        };
    }
}
