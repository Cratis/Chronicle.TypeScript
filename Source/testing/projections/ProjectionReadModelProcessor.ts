// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import { deserializeReadModel } from '../../readModels/deserializeReadModel.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { IReadModelProcessor } from '../IReadModelProcessor.js';
import type { ReadModelState } from '../ReadModelState.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import { ProjectionCapabilities } from './ProjectionCapabilities.js';
import { ProjectionExpressionEvaluator } from './ProjectionExpressionEvaluator.js';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';
import { UnsupportedProjectionOperation } from './UnsupportedProjectionOperation.js';

/** In-process interpreter of the validated, registered projection contract subset. */
export class ProjectionReadModelProcessor<TReadModel extends object> implements IReadModelProcessor<TReadModel> {
    private readonly _schema: JsonSchema;
    private readonly _initial: Record<string, unknown>;
    private readonly _from: ReadonlyMap<string, FromRecord>;
    private readonly _removed: ReadonlySet<string>;
    private readonly _eventSchemas: ReadonlyMap<string, JsonSchema>;
    private readonly _bindings: ReadonlyMap<string, { generation: number; path: string; declaration: string }>;
    private _engineState: Record<string, Record<string, unknown>> = {};
    private _publicRead: Record<string, Record<string, unknown>> = {};

    constructor(private readonly _model: Constructor<TReadModel>, compiled: CompiledProjectionDefinitions, private readonly _definition: ProjectionDefinition) {
        ProjectionCapabilities.validate(compiled, _definition);
        const registration = compiled.readModels.find(entry => entry.Type.Identifier === _definition.ReadModel)!;
        this._schema = JSON.parse(registration.Schema) as JsonSchema;
        this._initial = JSON.parse(_definition.InitialModelState || '{}') as Record<string, unknown>;
        const wire = _definition as unknown as { From: FromRecord[]; RemovedWith: RemovedWithRecord[] };
        this._from = new Map((wire.From ?? []).map(entry => [entry.Key.Id, entry]));
        this._removed = new Set((wire.RemovedWith ?? []).map(entry => entry.Key.Id));
        this._bindings = new Map([...(wire.From ?? []), ...(wire.RemovedWith ?? [])].map(entry => {
            const section = (wire.From ?? []).includes(entry as FromRecord) ? 'From' : 'RemovedWith';
            const path = eventContractPath(section, entry.Key);
            const declaration = compiled.provenance.get(_definition)?.find(provenance => provenance.contractPath === path)?.declaration ?? 'contract';
            return [entry.Key.Id, { generation: entry.Key.Generation, path, declaration }];
        }));
        this._eventSchemas = new Map([...(compiled.eventSchemas.get(_definition) ?? new Map()).values()]
            .map(entry => [entry.eventType.Id, entry.schema]));
    }

    /** A snapshot of the production-style in-memory sink, for kernel conformance fixtures. */
    get engineState(): Record<string, Record<string, unknown>> { return structuredClone(this._engineState); }
    /** A schema-normalized keyed read, for kernel conformance fixtures. */
    get publicRead(): Record<string, Record<string, unknown>> { return structuredClone(this._publicRead); }

    async process(events: readonly ScenarioEvent[]): Promise<Map<string, ReadModelState<TReadModel>>> {
        const states = new Map<string, ReadModelState<TReadModel>>();
        const engine: Record<string, Record<string, unknown>> = Object.create(null);
        for (const event of events) {
            const typeId = event.context.eventType.id.value;
            const from = this._from.get(typeId);
            const removed = this._removed.has(typeId);
            if (!from && !removed) continue;
            const binding = this._bindings.get(typeId)!;
            if (event.context.eventType.generation.value !== binding.generation) {
                throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                    `seeded event generation ${event.context.eventType.generation.value} differs from subscribed generation ${binding.generation}; multi-generation history requires a kernel-backed test`);
            }
            // A root removal has the final say when an event is registered for both operations.
            const key = this.keyFor(event.sourceId);
            if (removed) {
                delete engine[key];
                states.set(event.sourceId, { instance: null, deleted: true });
                continue;
            }
            if (!from) continue;
            const state = engine[key] ?? this.initialState(key, event);
            const properties = { ...from.Value.Properties };
            const schema = this._eventSchemas.get(typeId);
            const content = ProjectionValueConverter.eventContent(event.content, schema!);
            if (this._definition.AutoMap !== AutoMap.Disabled && schema) {
                const explicit = new Set(Object.keys(properties).map(name => name.toLowerCase()));
                const excluded = new Set((this._definition.NoAutoMapProperties ?? []).map(name => name.toLowerCase()));
                for (const source of Object.keys(schema.properties ?? {})) {
                    const destination = Object.keys(this._schema.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
                    if (destination && !explicit.has(destination.toLowerCase()) && !excluded.has(destination.toLowerCase())) {
                        properties[destination] = source;
                        explicit.add(destination.toLowerCase());
                    }
                }
            }
            for (const [destination, expression] of Object.entries(properties)) {
                const target = this._schema.properties![destination];
                const value = ProjectionExpressionEvaluator.value(expression, content, event.context, target);
                // The kernel compares old and new null values; null on an absent member is no change.
                if (value !== null || state[destination] !== undefined) state[destination] = value;
            }
            // InMemorySink.ApplyChanges always restores lowercase id after applying mappings.
            state.id = ProjectionValueConverter.convert(key, this._schema.properties!.id);
            engine[key] = state;
            states.set(event.sourceId, { instance: this.materialize(state), deleted: false });
        }
        this._engineState = engine;
        this._publicRead = Object.fromEntries(Object.entries(engine).map(([key, value]) => [key, this.normalize(value)]));
        return states;
    }

    private keyFor(source: string): string {
        const identifier = this._schema.properties!.id;
        const canonical = String(ProjectionValueConverter.convert(source, identifier));
        if (identifier.format === 'guid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(source)) {
            throw new RangeError(`Projection event source '${source}' is not a canonical GUID identifier.`);
        }
        if (canonical !== source) throw new RangeError(`Projection event source '${source}' is not a canonical ${identifier.type} identifier.`);
        return canonical;
    }

    private initialState(key: string, event: ScenarioEvent): Record<string, unknown> {
        const initial: Record<string, unknown> = Object.create(null);
        if (Object.keys(this._initial).length) {
            Object.assign(initial, ProjectionValueConverter.convert(structuredClone(this._initial), this._schema, false, false));
        }
        if (!Object.keys(this._initial).length) {
            for (const [name, property] of Object.entries(this._schema.properties ?? {})) {
                if (property.type === 'array') initial[name] = [];
            }
        }
        initial.id = ProjectionValueConverter.convert(key, this._schema.properties!.id);
        initial.__subject = event.context.subject ?? event.sourceId;
        initial.__initialized = true;
        return initial;
    }

    private normalize(state: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = Object.create(null);
        for (const [name, schema] of Object.entries(this._schema.properties ?? {})) {
            const value = state[name];
            if (value !== undefined && value !== null) result[name] = value;
            else {
                const fallback = ProjectionValueConverter.defaultValue(schema);
                if (fallback !== null && fallback !== undefined) result[name] = fallback;
            }
        }
        return result;
    }

    private materialize(state: Record<string, unknown>): TReadModel {
        return deserializeReadModel(this._model, JSON.stringify(this.normalize(state)));
    }
}
