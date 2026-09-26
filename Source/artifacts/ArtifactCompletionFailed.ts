// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A lease completion failure that prevents acknowledgement, including when processing also failed. */
export class ArtifactCompletionFailed extends Error {
    /** The original completion rejection. */
    readonly completionError: unknown;
    /** The original processing rejection, if processing also failed. */
    readonly processingError: unknown;

    constructor(completionError: unknown, processingError?: unknown) {
        super(`Artifact completion failed: ${String(completionError)}`, { cause: completionError });
        this.name = 'ArtifactCompletionFailed';
        this.completionError = completionError;
        this.processingError = processingError;
        if (processingError instanceof Error) {
            this.stack += `\nProcessing failure:\n${processingError.stack ?? String(processingError)}`;
        }
    }
}
