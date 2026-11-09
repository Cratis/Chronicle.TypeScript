// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The exception that is thrown when the kernel refuses a chunk of an import. */
export class ImportChunkRefused extends Error {
    /**
     * Creates a new {@link ImportChunkRefused}.
     * @param chunkIndex - The index of the chunk.
     * @param reason - Why the kernel refused it.
     */
    constructor(readonly chunkIndex: number, readonly reason: string) {
        super(`The kernel refused chunk ${chunkIndex} of the import: ${reason}`);
        this.name = 'ImportChunkRefused';
    }
}
