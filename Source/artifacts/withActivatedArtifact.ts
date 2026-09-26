// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { diag } from '@opentelemetry/api';
import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from './ActivatedArtifact.js';
import type { ArtifactActivationContext } from './ArtifactActivationContext.js';
import type { ClientArtifactsActivator } from './ClientArtifactsActivator.js';

const logger = diag.createComponentLogger({ namespace: '@cratis/chronicle/artifacts' });

/** Activates once per delivery and always releases the lease before acknowledgement. */
export async function withActivatedArtifact<T, R>(
    type: Constructor<T>, context: ArtifactActivationContext, activator: ClientArtifactsActivator,
    callback: (artifact: ActivatedArtifact<T>) => Promise<R>
): Promise<R> {
    const artifact = await activator(type, context);
    try {
        return await callback(artifact);
    } finally {
        try {
            await artifact.dispose?.();
        } catch (error) {
            logger.error('Error disposing activated artifact', { kind: context.kind, artifactId: context.artifactId, error: String(error) });
        }
    }
}

/** Enters an optional execution boundary for one handler and all of its returned effects. */
export async function runActivated<R>(artifact: ActivatedArtifact<unknown>, callback: () => R | Promise<R>): Promise<R> {
    return artifact.run ? artifact.run(callback) : callback();
}
