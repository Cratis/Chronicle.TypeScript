// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReadModelChangeset } from '@cratis/chronicle.contracts';

export class a_kernel_stream implements AsyncIterableIterator<ReadModelChangeset> {
    private readonly _messages: IteratorResult<ReadModelChangeset>[] = [];
    private _waiting?: {
        resolve: (result: IteratorResult<ReadModelChangeset>) => void;
        reject: (error: unknown) => void;
    };
    signal!: AbortSignal;
    closed = false;

    [Symbol.asyncIterator]() { return this; }

    next(): Promise<IteratorResult<ReadModelChangeset>> {
        const message = this._messages.shift();
        if (message) return Promise.resolve(message);
        if (this.closed) return Promise.resolve({ done: true, value: undefined });
        return new Promise((resolve, reject) => { this._waiting = { resolve, reject }; });
    }

    async return(): Promise<IteratorResult<ReadModelChangeset>> {
        this.end();
        return { done: true, value: undefined };
    }

    send(change: Partial<ReadModelChangeset>): void {
        const result = { done: false as const, value: ReadModelChangeset.fromPartial(change) };
        if (this._waiting) {
            this._waiting.resolve(result);
            this._waiting = undefined;
        } else this._messages.push(result);
    }

    end(): void {
        this.closed = true;
        this._waiting?.resolve({ done: true, value: undefined });
        this._waiting = undefined;
    }

    fail(error: Error): void {
        if (!this._waiting) throw new Error('The stream must be reading before failing it.');
        this._waiting.reject(error);
        this._waiting = undefined;
    }
}
