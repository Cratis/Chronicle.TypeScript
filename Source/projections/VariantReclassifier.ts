// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { ContractEventType, FromRecord, JoinRecord } from './declarative/ProjectionBuilderCore';
import { GlobalHandlerPropertyNotOnVariant } from './GlobalHandlerPropertyNotOnVariant';
import { VariantMustDeclareEntersOnEvent } from './VariantMustDeclareEntersOnEvent';

const EVENT_SOURCE_ID_KEY = '$eventSourceId';

/**
 * What one variant declared about being part of a mutually exclusive group, carried from the
 * point its definition was built to the cross-wiring pass that runs once every variant in the
 * group is known.
 */
export interface VariantDeclaration {
    /** The identity value used to group definitions for the cross-wiring pass. */
    readonly identity: Function;
    /** The variant's own key property name, used as the correlation property for reclassified joins. */
    readonly key: string;
    /** The event types that activate this variant. */
    readonly enteringEventTypes: ContractEventType[];
}

/**
 * A built projection definition, tagged with its variant declaration when it is one.
 */
export interface BuiltProjection {
    readonly typeName: string;
    readonly definition: Record<string, unknown>;
    readonly variant?: VariantDeclaration;
}

function eventTypeKey(eventType: ContractEventType): string {
    return `${eventType.Id}:${eventType.Generation}:${eventType.Tombstone}`;
}

/**
 * Merges every mapping a globalFor shared handler declares into a variant's From records, keyed
 * by event type. Runs before {@link reclassify} so a shared mapping for a non-entering event is
 * turned into an update-only join exactly like a mapping declared directly on the variant.
 * @param variantTypeName - The name of the variant type, used for error reporting.
 * @param variantMemberNames - The property names the variant actually has.
 * @param from - The variant's own From records.
 * @param globalHandlers - The shared handler From records applicable to this variant's identity, keyed by handler type name.
 * @returns The merged From records.
 * @throws {@link GlobalHandlerPropertyNotOnVariant} when a shared mapping targets a member the variant does not have.
 */
export function mergeGlobalHandlers(
    variantTypeName: string,
    variantMemberNames: ReadonlySet<string>,
    from: FromRecord[],
    globalHandlers: ReadonlyMap<string, FromRecord[]>
): FromRecord[] {
    if (globalHandlers.size === 0) {
        return from;
    }

    const byEventType = new Map<string, FromRecord>();
    for (const record of from) {
        byEventType.set(eventTypeKey(record.Key), record);
    }

    for (const [globalHandlerTypeName, globalRecords] of globalHandlers) {
        for (const globalRecord of globalRecords) {
            for (const propertyName of Object.keys(globalRecord.Value.Properties)) {
                if (!variantMemberNames.has(propertyName)) {
                    throw new GlobalHandlerPropertyNotOnVariant(globalHandlerTypeName, variantTypeName, propertyName);
                }
            }

            const key = eventTypeKey(globalRecord.Key);
            const existing = byEventType.get(key);
            byEventType.set(key, existing
                ? { Key: existing.Key, Value: { ...existing.Value, Properties: { ...existing.Value.Properties, ...globalRecord.Value.Properties } } }
                : globalRecord);
        }
    }

    return Array.from(byEventType.values());
}

/**
 * Reclassifies every From record that is not one of the entering event types into an update-only
 * join on the variant's own key. The entering event(s) keep their ordinary create-or-update From
 * handler; everything else becomes a self-referential join that can bring an already-active
 * instance up to date but can never create one.
 * @param variantTypeName - The name of the variant type, used for error reporting.
 * @param from - The variant's own (possibly merged) From records.
 * @param join - The variant's own Join records, unaffected by reclassification.
 * @param enteringEventTypes - The event types that activate this variant.
 * @param variantKey - The variant's own key property name.
 * @returns The reclassified From and Join records.
 * @throws {@link VariantMustDeclareEntersOnEvent} when enteringEventTypes is empty.
 */
export function reclassify(
    variantTypeName: string,
    from: FromRecord[],
    join: JoinRecord[],
    enteringEventTypes: ContractEventType[],
    variantKey: string
): { from: FromRecord[]; join: JoinRecord[] } {
    if (enteringEventTypes.length === 0) {
        throw new VariantMustDeclareEntersOnEvent(variantTypeName);
    }

    const entering = new Set(enteringEventTypes.map(eventTypeKey));
    const remainingFrom: FromRecord[] = [];
    const reclassifiedJoins: JoinRecord[] = [];

    for (const record of from) {
        if (entering.has(eventTypeKey(record.Key))) {
            remainingFrom.push(record);
        } else {
            reclassifiedJoins.push({
                Key: record.Key,
                Value: {
                    On: variantKey,
                    Key: record.Value.Key || EVENT_SOURCE_ID_KEY,
                    Properties: record.Value.Properties
                }
            });
        }
    }

    return { from: remainingFrom, join: [...join, ...reclassifiedJoins] };
}

/**
 * Gives every variant a RemovedWith entry for every sibling's entering event(s), and none for
 * its own - the mutual-exclusion cross-wiring that can only run once every variant of a group
 * has been built.
 *
 * A variant cannot be told what removes it while it is being built, because its siblings are
 * not known yet. This runs once per registration call, over every variant discovered in that
 * call.
 * @param projections - Every built projection definition from this registration call, tagged with its variant declaration when it is one.
 */
export function crossWireGroups(projections: BuiltProjection[]): void {
    const variantEntries = projections.filter((entry): entry is BuiltProjection & { variant: VariantDeclaration } => entry.variant !== undefined);
    if (variantEntries.length === 0) {
        return;
    }

    const byIdentity = new Map<Function, typeof variantEntries>();
    for (const entry of variantEntries) {
        const group = byIdentity.get(entry.variant.identity) ?? [];
        group.push(entry);
        byIdentity.set(entry.variant.identity, group);
    }

    for (const entry of variantEntries) {
        const siblings = (byIdentity.get(entry.variant.identity) ?? []).filter(sibling => sibling !== entry);
        if (siblings.length === 0) {
            continue;
        }

        const existingRemovedWith = (entry.definition.RemovedWith as Array<{ Key: ContractEventType; Value: { Key: string; ParentKey: string } }>) ?? [];
        const removedWithByEventType = new Map<string, { Key: ContractEventType; Value: { Key: string; ParentKey: string } }>();
        for (const record of existingRemovedWith) {
            removedWithByEventType.set(eventTypeKey(record.Key), record);
        }

        for (const sibling of siblings) {
            for (const eventType of sibling.variant.enteringEventTypes) {
                const key = eventTypeKey(eventType);
                if (!removedWithByEventType.has(key)) {
                    removedWithByEventType.set(key, {
                        Key: eventType,
                        Value: { Key: EVENT_SOURCE_ID_KEY, ParentKey: EVENT_SOURCE_ID_KEY }
                    });
                }
            }
        }

        entry.definition.RemovedWith = Array.from(removedWithByEventType.values());
    }
}
