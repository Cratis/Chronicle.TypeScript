// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { AutoMap, type ProjectionDefinition } from '@cratis/chronicle.contracts';
import type { Constructor } from '@cratis/fundamentals';
import type { CompiledProjectionDefinitions } from '../../projections/CompiledProjectionDefinitions.js';
import { eventContractPath } from '../../projections/eventContractPath.js';
import type { FromRecord, RemovedWithRecord } from '../../projections/declarative/ProjectionBuilderCore.js';
import type { ChildrenDefinitionLike } from '../../projections/modelBound/childrenAndNestedBuilder.js';
import { deserializeReadModel } from '../../readModels/deserializeReadModel.js';
import type { JsonSchema } from '../../schemas/JsonSchema.js';
import type { IReadModelProcessor } from '../IReadModelProcessor.js';
import type { ReadModelState } from '../ReadModelState.js';
import type { ScenarioEvent } from '../ScenarioEvent.js';
import { ProjectionCapabilities } from './ProjectionCapabilities.js';
import { ProjectionExpressionEvaluator } from './ProjectionExpressionEvaluator.js';
import { ProjectionValueConverter } from './ProjectionValueConverter.js';
import { UnsupportedProjectionOperation } from './UnsupportedProjectionOperation.js';

interface ChildBinding {
    readonly property: string;
    readonly identifiedBy: string;
    readonly key: string;
    readonly from: FromRecord | undefined;
    readonly items: JsonSchema;
}

/** In-process interpreter of the validated, registered projection contract subset. */
export class ProjectionReadModelProcessor<TReadModel extends object> implements IReadModelProcessor<TReadModel> {
    private readonly _schema: JsonSchema;
    private readonly _initial: Record<string, unknown>;
    private readonly _from: ReadonlyMap<string, FromRecord>;
    private readonly _removed: ReadonlySet<string>;
    private readonly _children: ReadonlyMap<string, ChildBinding>;
    private readonly _eventSchemas: ReadonlyMap<string, JsonSchema>;
    private readonly _bindings: ReadonlyMap<string, { generation: number; path: string; declaration: string }>;
    private _engineState: Record<string, Record<string, unknown>> = {};
    private _publicRead: Record<string, Record<string, unknown>> = {};

    constructor(private readonly _model: Constructor<TReadModel>, compiled: CompiledProjectionDefinitions, private readonly _definition: ProjectionDefinition) {
        ProjectionCapabilities.validate(compiled, _definition);
        const registration = compiled.readModels.find(entry => entry.Type.Identifier === _definition.ReadModel)!;
        this._schema = JSON.parse(registration.Schema) as JsonSchema;
        this._initial = JSON.parse(_definition.InitialModelState || '{}') as Record<string, unknown>;
        const wire = _definition as unknown as { From: FromRecord[]; RemovedWith: RemovedWithRecord[]; Children?: Record<string, ChildrenDefinitionLike> };
        this._from = new Map((wire.From ?? []).map(entry => [entry.Key.Id, entry]));
        this._removed = new Set((wire.RemovedWith ?? []).map(entry => entry.Key.Id));
        const declarationFor = (path: string) => compiled.provenance.get(_definition)?.find(provenance => provenance.contractPath === path)?.declaration;
        const bindings = [...(wire.From ?? []), ...(wire.RemovedWith ?? [])].map(entry => {
            const section = (wire.From ?? []).includes(entry as FromRecord) ? 'From' : 'RemovedWith';
            const path = eventContractPath(section, entry.Key);
            return [entry.Key.Id, { generation: entry.Key.Generation, path, declaration: declarationFor(path) ?? 'contract' }] as const;
        });
        const children = new Map<string, ChildBinding>();
        for (const [property, child] of Object.entries(wire.Children ?? {})) {
            const items = this._schema.properties![property].items!;
            for (const entry of [...child.From, ...child.RemovedWith]) {
                const from = child.From.includes(entry as FromRecord) ? entry as FromRecord : undefined;
                const path = `Children.${property}.${eventContractPath(from ? 'From' : 'RemovedWith', entry.Key)}`;
                children.set(entry.Key.Id, { property, identifiedBy: child.IdentifiedBy, key: entry.Value.Key, from, items });
                if (!bindings.some(([id]) => id === entry.Key.Id)) {
                    bindings.push([entry.Key.Id, { generation: entry.Key.Generation, path, declaration: declarationFor(`Children.${property}`) ?? 'contract' }]);
                }
            }
        }
        this._children = children;
        this._bindings = new Map(bindings);
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
            const child = this._children.get(typeId);
            if (!from && !removed && !child) continue;
            const binding = this._bindings.get(typeId)!;
            if (event.context.eventType.generation.value !== binding.generation) {
                throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                    `seeded event generation ${event.context.eventType.generation.value} differs from subscribed generation ${binding.generation}; multi-generation history requires a kernel-backed test`);
            }
            const key = this.keyFor(event.sourceId);
            if (removed) {
                delete engine[key];
                states.set(event.sourceId, { instance: null, deleted: true });
                continue;
            }
            const schema = this._eventSchemas.get(typeId)!;
            const content = ProjectionValueConverter.eventContent(event.content, schema);
            let state = engine[key];
            if (!state) {
                // SetInitialState: an event only a child subscribes to creates an uninitialized parent.
                state = from ? this.initialState(key, event) : this.identityState(key, event, false);
            } else if (state.__initialized === false) {
                for (const [name, value] of Object.entries(this.initialValues())) if (!(name in state)) state[name] = value;
                state.__initialized = true;
            }
            if (from) {
                const explicit = { ...from.Value.Properties };
                const excluded = (this._definition.NoAutoMapProperties ?? []);
                const properties = this._definition.AutoMap !== AutoMap.Disabled ? this.withAutoMap(explicit, schema, this._schema, excluded) : explicit;
                this.apply(properties, content, event, this._schema, state);
            }
            if (child) this.applyChild(child, content, event, schema, state, binding);
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

    private applyChild(child: ChildBinding, content: unknown, event: ScenarioEvent, eventSchema: JsonSchema, state: Record<string, unknown>,
        binding: { path: string; declaration: string }): void {
        const identity = ProjectionExpressionEvaluator.pathValue(content, child.key);
        if (typeof identity !== 'string') {
            throw new UnsupportedProjectionOperation(String(this._definition.ReadModel), binding.path, binding.declaration,
                `child key '${child.key}' has no string value in the seeded event; missing child keys require a kernel-backed test`);
        }
        const collection = (state[child.property] ??= []) as Record<string, unknown>[];
        const index = collection.findIndex(item => item[child.identifiedBy] === identity);
        if (!child.from) {
            if (index >= 0) collection.splice(index, 1);
            return;
        }
        const item = index >= 0 ? collection[index] : { [child.identifiedBy]: identity };
        if (index < 0) collection.push(item);
        // Validation admits only the identifier mapping explicitly; other fields come from same-name AutoMap.
        // Kernel AutoMap is schema-driven: an untyped child item schema maps nothing (children-untyped-items).
        const properties = child.items.properties ? this.withAutoMap({}, eventSchema, child.items, [child.identifiedBy]) : {};
        this.apply(properties, content, event, child.items, item);
    }

    private withAutoMap(explicit: Record<string, string>, eventSchema: JsonSchema, target: JsonSchema, exclusions: readonly string[]): Record<string, string> {
        const properties = { ...explicit };
        const mapped = new Set(Object.keys(properties).map(name => name.toLowerCase()));
        const excluded = new Set(exclusions.map(name => name.toLowerCase()));
        for (const source of Object.keys(eventSchema.properties ?? {})) {
            const destination = Object.keys(target.properties ?? {}).find(name => name.toLowerCase() === source.toLowerCase());
            if (destination && !mapped.has(destination.toLowerCase()) && !excluded.has(destination.toLowerCase())) {
                properties[destination] = source;
                mapped.add(destination.toLowerCase());
            }
        }
        return properties;
    }

    private apply(properties: Record<string, string>, content: unknown, event: ScenarioEvent, target: JsonSchema, state: Record<string, unknown>): void {
        for (const [destination, expression] of Object.entries(properties)) {
            const value = ProjectionExpressionEvaluator.value(expression, content, event.context, target.properties![destination]);
            // The kernel compares old and new null values; null on an absent member is no change.
            if (value !== null || state[destination] !== undefined) state[destination] = value;
        }
    }

    private initialValues(): Record<string, unknown> {
        const initial: Record<string, unknown> = Object.create(null);
        if (Object.keys(this._initial).length) {
            return Object.assign(initial, ProjectionValueConverter.convert(structuredClone(this._initial), this._schema, false, false));
        }
        for (const [name, property] of Object.entries(this._schema.properties ?? {})) {
            if (property.type === 'array') initial[name] = [];
        }
        return initial;
    }

    private initialState(key: string, event: ScenarioEvent): Record<string, unknown> {
        return Object.assign(this.initialValues(), this.identityState(key, event, true));
    }

    private identityState(key: string, event: ScenarioEvent, initialized: boolean): Record<string, unknown> {
        const state: Record<string, unknown> = Object.create(null);
        state.id = ProjectionValueConverter.convert(key, this._schema.properties!.id);
        state.__subject = event.context.subject ?? event.sourceId;
        state.__initialized = initialized;
        return state;
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
