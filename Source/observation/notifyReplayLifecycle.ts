// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ReplayState } from '@cratis/chronicle.contracts';
import { ICanBeNotifiedWhenPartitionReplayed } from './ICanBeNotifiedWhenPartitionReplayed';
import { ICanBeNotifiedWhenReplay } from './ICanBeNotifiedWhenReplay';

function hasReplayLifecycleHooks(instance: unknown): instance is ICanBeNotifiedWhenReplay {
    if (typeof instance !== 'object' || instance === null) {
        return false;
    }

    const candidate = instance as Record<string, unknown>;
    return typeof candidate.beginReplay === 'function' && typeof candidate.endReplay === 'function';
}

function hasPartitionReplayLifecycleHooks(instance: unknown): instance is ICanBeNotifiedWhenPartitionReplayed {
    if (typeof instance !== 'object' || instance === null) {
        return false;
    }

    const candidate = instance as Record<string, unknown>;
    return typeof candidate.beginReplayPartition === 'function' && typeof candidate.endReplayPartition === 'function';
}

/**
 * Notifies a reactor/reducer instance of a replay-state transition signaled by the Chronicle Kernel,
 * when the instance optionally implements {@link ICanBeNotifiedWhenReplay} and/or
 * {@link ICanBeNotifiedWhenPartitionReplayed}. A no-op for {@link ReplayState.REPLAY_STATE_None} or
 * when the instance implements neither contract.
 * @param instance - The reactor/reducer instance to notify.
 * @param replayState - The replay-state transition signaled for the current batch.
 * @param partition - The partition the transition applies to, for the partition-scoped states.
 * @returns A promise that resolves when the relevant callback (if any) has completed.
 */
export async function notifyReplayLifecycle(instance: unknown, replayState: ReplayState, partition: string): Promise<void> {
    switch (replayState) {
        case ReplayState.BeginReplay:
            if (hasReplayLifecycleHooks(instance)) {
                await instance.beginReplay();
            }
            break;
        case ReplayState.EndReplay:
            if (hasReplayLifecycleHooks(instance)) {
                await instance.endReplay();
            }
            break;
        case ReplayState.BeginReplayPartition:
            if (hasPartitionReplayLifecycleHooks(instance)) {
                await instance.beginReplayPartition(partition);
            }
            break;
        case ReplayState.EndReplayPartition:
            if (hasPartitionReplayLifecycleHooks(instance)) {
                await instance.endReplayPartition(partition);
            }
            break;
        default:
            break;
    }
}
