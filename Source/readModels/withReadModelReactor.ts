// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Constructor } from '@cratis/fundamentals';
import { ArtifactCompletionFailed } from '../artifacts/ArtifactCompletionFailed.js';
import type { ActivatedArtifact } from '../artifacts/ActivatedArtifact.js';
import { createLogger } from '../logging/createLogger.js';
import type { IChronicleLogger } from '../logging/IChronicleLogger.js';
import type { ReadModelReactorActivator } from './ReadModelReactorActivator.js';
import type { ReadModelReactorActivationContext } from './ReadModelReactorActivationContext.js';

/** Uses the artifact lease protocol without extending event activation or invocation unions. */
export async function withReadModelReactor<T>(type: Constructor<T>, context: ReadModelReactorActivationContext,
    callback: (instance: T) => Promise<void>, options: { activator?: ReadModelReactorActivator; logger?: IChronicleLogger }): Promise<void> {
    const artifact: ActivatedArtifact<T> = options.activator ? await options.activator(type, context) : { instance: new type() };
    try {
        await processLease(artifact, callback);
    } finally {
        try {
            await artifact.dispose?.();
        } catch (error) {
            createLogger('@cratis/chronicle/readModels', options.logger).error('Error disposing read-model reactor', { artifactId: context.artifactId, error });
        }
    }
}

async function processLease<T>(artifact: ActivatedArtifact<T>, callback: (instance: T) => Promise<void>): Promise<void> {
    let processingFailed = false;
    let processingError: unknown;
    try {
        const invoke = () => callback(artifact.instance);
        await (artifact.run ? artifact.run(invoke) : invoke());
    } catch (error) {
        processingFailed = true;
        processingError = error;
    }
    try {
        await artifact.complete?.();
    } catch (error) {
        throw new ArtifactCompletionFailed(error, processingError);
    }
    if (processingFailed) throw processingError;
}
