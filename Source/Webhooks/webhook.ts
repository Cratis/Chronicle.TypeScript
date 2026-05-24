// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import 'reflect-metadata';
import { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '../types';
import { WebhookId } from './WebhookId';
import { WebhookTargetUrl } from './WebhookTargetUrl';

/** Metadata key used to store webhook information on a class. */
const WEBHOOK_METADATA_KEY = 'chronicle:webhook';

/**
 * Metadata stored on a webhook class.
 */
export interface WebhookMetadata {
    /** The webhook identifier. */
    readonly id: WebhookId;

    /** The webhook target URL. */
    readonly targetUrl: WebhookTargetUrl;

    /** Optional explicit event sequence id. */
    readonly eventSequenceId: string | undefined;
}

/**
 * TypeScript decorator that marks a class as a discoverable webhook.
 * @param id - The webhook identifier. Defaults to class name when omitted.
 * @param targetUrl - The webhook target URL.
 * @param eventSequenceId - Optional event sequence identifier.
 * @returns A class decorator.
 */
export function webhook(id: string = '', targetUrl: string = '', eventSequenceId?: string): ClassDecorator {
    return (target: object) => {
        const constructor = target as Function;
        const webhookId = new WebhookId(id || constructor.name);
        const metadata: WebhookMetadata = {
            id: webhookId,
            targetUrl: new WebhookTargetUrl(targetUrl),
            eventSequenceId
        };
        Reflect.defineMetadata(WEBHOOK_METADATA_KEY, metadata, target);
        TypeDiscoverer.default.register(
            DecoratorType.Webhook,
            constructor as Constructor,
            webhookId.value
        );
    };
}

/**
 * Gets webhook metadata from a webhook class.
 * @param target - The class constructor.
 * @returns The metadata, if any.
 */
export function getWebhookMetadata(target: Function): WebhookMetadata | undefined {
    return Reflect.getMetadata(WEBHOOK_METADATA_KEY, target);
}

/**
 * Checks whether a class has webhook metadata.
 * @param target - The class constructor.
 * @returns True when decorated as webhook.
 */
export function isWebhook(target: Function): boolean {
    return Reflect.hasMetadata(WEBHOOK_METADATA_KEY, target);
}
