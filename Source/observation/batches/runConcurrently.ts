// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * Runs a callback for every item, with at most a given number running at the same time, and keeps the results in item order.
 * @param items - The items.
 * @param maxConcurrency - The most callbacks running at the same time; `1` runs them one after another.
 * @param callback - The callback for one item.
 * @returns The results, in the order of the items.
 */
export async function runConcurrently<TItem, TResult>(items: readonly TItem[], maxConcurrency: number,
    callback: (item: TItem, index: number) => Promise<TResult>): Promise<TResult[]> {
    const results = new Array<TResult>(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await callback(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(maxConcurrency, items.length)) }, worker));
    return results;
}
