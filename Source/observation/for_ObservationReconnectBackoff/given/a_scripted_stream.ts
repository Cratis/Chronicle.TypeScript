// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** How one observation stream behaves: what it delivers, how long it stays open and the error it ends with, if any. */
export interface StreamScript<T> {
    /** What the stream delivers before it ends. */
    deliver?: T[];

    /** How long, in milliseconds, the stream stays open after delivering before it ends. */
    openForMs?: number;

    /** Whether the stream stays open until the client aborts it. */
    untilAborted?: boolean;

    /** How long, in milliseconds, an aborted stream takes to end, as a slow transport would. */
    endsLateByMs?: number;

    /** The error the stream ends with. */
    error?: unknown;
}

/** Records the observation streams a reactor or reducer opens and plays them by their scripts. */
export class a_scripted_stream<T> {
    readonly openedAt: number[] = [];
    readonly scripts: StreamScript<T>[] = [];
    open = 0;

    /** The observe method of the fake kernel connection. */
    readonly observe = (_messages: unknown, options: { signal: AbortSignal }): AsyncGenerator<T> => this.play(options.signal);

    /** Gets the wait before each stream after the first was opened. */
    get waits(): number[] {
        return this.openedAt.slice(1).map((at, index) => at - this.openedAt[index]);
    }

    private async *play(signal: AbortSignal): AsyncGenerator<T> {
        this.openedAt.push(Date.now());
        this.open++;
        try {
            const script = this.scripts.shift() ?? {};
            for (const delivery of script.deliver ?? []) yield delivery;
            if (script.openForMs) await new Promise(resolve => setTimeout(resolve, script.openForMs));
            if (script.untilAborted) {
                await new Promise<void>(resolve => signal.aborted ? resolve() : signal.addEventListener('abort', () => resolve(), { once: true }));
                if (script.endsLateByMs) await new Promise(resolve => setTimeout(resolve, script.endsLateByMs));
            }
            if (script.error) throw script.error;
        } finally {
            this.open--;
        }
    }
}
