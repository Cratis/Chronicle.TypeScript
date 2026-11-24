// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { describe, expect, it, vi } from 'vitest';
import { KernelStatus, type ConnectRequest } from '@cratis/chronicle.contracts';
import type { ChronicleLogEntry } from '../logging/ChronicleLogEntry.js';
import { KernelKeepAlive, type IKeepAliveConnections } from './KernelKeepAlive.js';

const request = { ConnectionId: 'connection-1' } as unknown as ConnectRequest;

/** Runs the keep-alive over the given keep-alives, answering each, and returns what it logged. */
async function logWhenKernelReports(statuses: Array<KernelStatus | undefined>): Promise<ChronicleLogEntry[]> {
    const entries: ChronicleLogEntry[] = [];
    const answer = vi.fn().mockResolvedValue({});
    async function* stream() {
        for (const status of statuses) yield { ConnectionId: 'connection-1', ...(status === undefined ? {} : { Status: status }) };
        await new Promise(() => {});
    }
    const controller = new AbortController();
    const connections = { connect: () => stream(), connectionKeepAlive: answer } as unknown as IKeepAliveConnections;
    await new KernelKeepAlive(connections, vi.fn(), { idleTimeoutMs: 1000, answerTimeoutMs: 1000 }, { log: entry => entries.push(entry) }).start(request, controller.signal);
    await vi.waitFor(() => expect(answer).toHaveBeenCalledTimes(statuses.length));
    controller.abort();
    return entries.filter(entry => entry.message.startsWith('Chronicle reports'));
}

describe('when the keep-alive reports the kernel status', () => {
    it('should warn once when the kernel is recovering, however many keep-alives say so', async () => {
        const entries = await logWhenKernelReports([KernelStatus.Accepting, KernelStatus.Recovering, KernelStatus.Recovering]);
        expect(entries.map(entry => [entry.level, entry.attributes.status])).toEqual([['warn', 'Recovering']]);
    });

    it('should tell when the kernel is accepting again after it was busy', async () => {
        const entries = await logWhenKernelReports([KernelStatus.Degraded, KernelStatus.Accepting]);
        expect(entries.map(entry => entry.level)).toEqual(['warn', 'info']);
    });

    it('should say nothing for a kernel that sends no status or reports that it is accepting', async () => {
        expect(await logWhenKernelReports([undefined, KernelStatus.Accepting])).toEqual([]);
    });

    it('should not crash on a status it does not know', async () => {
        const entries = await logWhenKernelReports([42 as KernelStatus]);
        expect(entries.map(entry => entry.level)).toEqual(['warn']);
    });
});
