// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createLogger } from '../logging/createLogger.js';
import type { IChronicleLogger } from '../logging/IChronicleLogger.js';
import type { Constructor } from '@cratis/fundamentals';
import type { ActivatedArtifact } from './ActivatedArtifact.js';
import type { ArtifactActivationContext } from './ArtifactActivationContext.js';
import type { ArtifactInvocationContext } from './ArtifactInvocationContext.js';
import { ArtifactCompletionFailed } from './ArtifactCompletionFailed.js';
import type { ClientArtifactsActivator } from './ClientArtifactsActivator.js';

/** Activates once per delivery and always releases the lease before acknowledgement. */
export async function withActivatedArtifact<T, R>(
    type: Constructor<T>, context: ArtifactActivationContext, activator: ClientArtifactsActivator,
    callback: (artifact: ActivatedArtifact<T>) => Promise<R>,
    logger?: IChronicleLogger
): Promise<R> {
    const artifact = await activator(type, context);
    try {
        let result!: R;
        let processingFailed = false;
        let processingError: unknown;
        try {
            result = await callback(artifact);
        } catch (error) {
            processingFailed = true;
            processingError = error;
        }
        try {
            await artifact.complete?.();
        } catch (error) {
            throw new ArtifactCompletionFailed(error, processingFailed ? processingError : undefined);
        }
        if (processingFailed) throw processingError;
        return result;
    } finally {
        try {
            await artifact.dispose?.();
        } catch (error) {
            createLogger('@cratis/chronicle/artifacts', logger).error('Error disposing activated artifact', {
                kind: context.kind, artifactId: context.artifactId, error
            });
        }
    }
}

/** Enters an optional execution boundary for one handler and all of its returned effects. */
export async function runActivated<R>(artifact: ActivatedArtifact<unknown>, callback: () => R | Promise<R>, invocation: ArtifactInvocationContext): Promise<R> {
    return artifact.run ? artifact.run(callback, invocation) : callback();
}
