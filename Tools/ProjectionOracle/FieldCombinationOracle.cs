// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;
extern alias KernelConcepts;
extern alias KernelStorage;
extern alias KernelInfrastructure;

using System.Collections.Immutable;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Chronicle.Testing.EventSequences;
using KernelContracts::Cratis.Chronicle.Contracts.Sequences;
using KernelServiceAccessor = KernelContracts::Cratis.Chronicle.Contracts.IChronicleServicesAccessor;
using KernelStore = KernelStorage::Cratis.Chronicle.Storage.IStorage;
using KernelStoreName = KernelConcepts::Cratis.Chronicle.Concepts.EventStoreName;
using KernelUnique = KernelConcepts::Cratis.Chronicle.Concepts.Events.Constraints.UniqueConstraintDefinition;
using KernelEventTypeId = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventTypeId;
using KernelGeneration = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventTypeGeneration;
using KernelEventType = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventType;
using KernelEventTypeSchema = KernelConcepts::Cratis.Chronicle.Concepts.EventTypes.EventTypeSchema;
using KernelSchema = KernelInfrastructure::Cratis.Chronicle.Schemas.JsonSchema;
using KernelConstraints = KernelContracts::Cratis.Chronicle.Contracts.Events.Constraints;

namespace ProjectionOracle;

[EventType("OracleCombinedNumber")]
public record OracleCombinedNumber(double Key, string Suffix, Guid Identifier);
[EventType("OracleCombinedGuid")]
public record OracleCombinedGuid(Guid Key, string Suffix, double Amount);
[EventType("OracleCombinedText")]
public record OracleCombinedText(string Key);
[EventType("OracleCombinedRemoved")]
public record OracleCombinedRemoved(string Label);

/// <summary>Raw JSON and pinned TypeScript protobuf requests: no CLR content normalization before append.</summary>
static class FieldCombinationOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        var cases = Expand(fixture["fieldCombinationCases"]!.AsArray());
        fixture = (JsonObject)fixture.DeepClone();
        fixture["fieldCombinationCases"] = cases;
        if (cases.Count == 0 || cases.Select(test => test!["name"]!.GetValue<string>()).Distinct().Count() != cases.Count)
            throw new InvalidOperationException("Field combination cases must be nonempty and uniquely named.");
        var wires = await Encode(fixture);
        if (wires.Count != cases.Count) throw new InvalidOperationException("Incomplete field combination wire evidence.");
        var results = new JsonArray();
        for (var index = 0; index < cases.Count; index++)
            results.Add(new JsonObject { ["name"] = cases[index]!["name"]!.DeepClone(),
                ["outcomes"] = await RunCase(cases[index]!.AsObject(), wires[index]!.AsObject()) });
        return new JsonObject { ["cases"] = results };
    }

    static JsonArray Expand(JsonArray templates)
    {
        var cases = new JsonArray();
        foreach (var template in templates)
            for (var mask = 0; mask < 8; mask++)
            {
                var test = (JsonObject)template!.DeepClone();
                test["name"] = $"{test["name"]!.GetValue<string>()}-{mask}";
                foreach (var definition in test["constraintDefinitions"]!.AsArray())
                    definition!["scope"] = new JsonObject { ["perEventSourceType"] = (mask & 1) != 0,
                        ["perEventStreamType"] = (mask & 2) != 0, ["perEventStreamId"] = (mask & 4) != 0 };
                cases.Add(test);
            }
        return cases;
    }

    static async Task<JsonArray> Encode(JsonObject fixture)
    {
        using var encoder = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("node", "Tools/ProjectionOracle/scope-wire.mjs")
        {
            RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false
        }) ?? throw new InvalidOperationException("Could not start the TypeScript wire encoder.");
        var output = encoder.StandardOutput.ReadToEndAsync();
        await encoder.StandardInput.WriteAsync(fixture.ToJsonString());
        encoder.StandardInput.Close();
        await encoder.WaitForExitAsync();
        if (encoder.ExitCode != 0) throw new InvalidOperationException("TypeScript wire encoding failed.");
        return JsonNode.Parse(await output)!.AsArray();
    }

    static T Decode<T>(JsonNode bytes) => ProtoBuf.Serializer.Deserialize<T>(new MemoryStream(Convert.FromBase64String(bytes.GetValue<string>())));

    static UniqueConstraintDefinition Definition(JsonNode node, JsonNode scopeBytes, JsonObject schemas)
    {
        var scope = Decode<KernelConstraints.ConstraintScope>(scopeBytes);
        AssertScope(scope, node["scope"]!);
        var message = node["message"]!.GetValue<string>();
        return new UniqueConstraintDefinition(node["name"]!.GetValue<string>(), _ => message, node["events"]!.AsArray().Select(entry =>
            new UniqueConstraintEventDefinition(schemas[entry!["type"]!.GetValue<string>()]!["eventTypeId"]!.GetValue<string>(),
                entry["properties"]!.AsArray().Select(property => property!.GetValue<string>()).ToArray())).ToArray(),
            node["removedWithEventTypeIds"]!.AsArray().Select(alias => (EventTypeId)schemas[alias!.GetValue<string>()]!["eventTypeId"]!.GetValue<string>()).ToArray(),
            node["ignoreCasing"]!.GetValue<bool>(), new ConstraintScope(
                scope.EventSourceType is null ? null : (EventSourceType)scope.EventSourceType,
                scope.EventStreamType is null ? null : (EventStreamType)scope.EventStreamType,
                scope.EventStreamId is null ? null : (EventStreamId)scope.EventStreamId));
    }

    static void AssertScope(KernelConstraints.ConstraintScope scope, JsonNode requested)
    {
        if (scope.EventSourceType != (requested["perEventSourceType"]!.GetValue<bool>() ? "*" : null) ||
            scope.EventStreamType != (requested["perEventStreamType"]!.GetValue<bool>() ? "*" : null) ||
            scope.EventStreamId != (requested["perEventStreamId"]!.GetValue<bool>() ? "*" : null))
            throw new InvalidOperationException("Scope wire omission semantics changed.");
    }

    static async Task Install(KernelStore storage, JsonObject test, UniqueConstraintDefinition[] definitions)
    {
        var store = storage.GetEventStore((KernelStoreName)"test-event-store");
        var installed = (await store.Constraints.GetDefinitions()).ToArray();
        if (installed.Length != definitions.Length) throw new InvalidOperationException("Unexpected installed constraints.");
        for (var index = 0; index < definitions.Length; index++)
            AssertDefinition((KernelUnique)installed[index], definitions[index]);
        // The packaged adapter's registration methods are no-ops. Replace this scenario's schemas only,
        // then read them back, as in FieldConstraintOracle: Number must be the client's unformatted number.
        var eventTypes = store.EventTypes;
        var catalogField = eventTypes.GetType().GetField("_schemas", BindingFlags.Instance | BindingFlags.NonPublic);
        if (catalogField?.GetValue(eventTypes) is not Lazy<Dictionary<KernelEventType, KernelEventTypeSchema>> catalog)
            throw new InvalidOperationException("The packaged discovered-schema catalog changed shape.");
        foreach (var (_, declaration) in test["eventSchemas"]!.AsObject())
            await InstallSchema(storage, catalog.Value, declaration!);
    }

    static void AssertDefinition(KernelUnique actual, UniqueConstraintDefinition definition)
    {
        var matches = new[]
        {
            actual.Name.Value == definition.Name.Value,
            actual.IgnoreCasing == definition.IgnoreCasing,
            actual.Scope?.EventSourceType?.Value == definition.Scope?.EventSourceType?.Value,
            actual.Scope?.EventStreamType?.Value == definition.Scope?.EventStreamType?.Value,
            actual.Scope?.EventStreamId?.Value == definition.Scope?.EventStreamId?.Value,
            actual.RemovedWith.Select(id => id.Value).SequenceEqual(definition.RemovedWith.Select(id => id.Value)),
            actual.EventDefinitions.Select(entry => (entry.EventTypeId.Value, string.Join(",", entry.Properties)))
                .SequenceEqual(definition.EventsWithProperties.Select(entry => (entry.EventTypeId.Value, string.Join(",", entry.Properties))))
        };
        if (matches.Any(match => !match)) throw new InvalidOperationException("Installed field combination definition differs from fixture.");
    }

    static async Task InstallSchema(KernelStore storage, Dictionary<KernelEventType, KernelEventTypeSchema> catalog, JsonNode declaration)
    {
        var eventTypes = storage.GetEventStore((KernelStoreName)"test-event-store").EventTypes;
        var id = declaration["eventTypeId"]!.GetValue<string>();
        var registered = await eventTypes.GetFor((KernelEventTypeId)id, (KernelGeneration)1);
        var properties = new JsonObject();
        foreach (var (property, kind) in declaration["properties"]!.AsObject())
            properties[property] = kind!.GetValue<string>() == "guid" ? new JsonObject { ["type"] = "string", ["format"] = "guid" }
                : new JsonObject { ["type"] = kind.GetValue<string>() };
        var schema = new JsonObject { ["type"] = "object", ["properties"] = properties,
            ["required"] = new JsonArray(properties.Select(property => (JsonNode?)property.Key).ToArray()), ["additionalProperties"] = false };
        catalog[registered.Type] = registered with { Schema = KernelSchema.FromJson(schema.ToJsonString()) };
        var effective = await eventTypes.GetFor((KernelEventTypeId)id, (KernelGeneration)1);
        if (!JsonNode.DeepEquals(JsonNode.Parse(effective.Schema.ToJson())!["properties"], properties))
            throw new InvalidOperationException("Installed field combination schema differs from fixture.");
    }

    static async Task<JsonArray> RunCase(JsonObject test, JsonObject wire)
    {
        var definitions = test["constraintDefinitions"]!.AsArray().Select((node, index) =>
            Definition(node!, wire["scopes"]![index]!, test["eventSchemas"]!.AsObject())).ToArray();
        using var scenario = new EventScenario(new OracleConstraintProvider(definitions.Cast<IConstraintDefinition>().ToImmutableArray()));
        var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
        var services = ((KernelServiceAccessor)created[1]!).Services;
        var storage = (KernelStore)services.Sequences.GetType().GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
            .Single(field => field.FieldType == typeof(KernelStore)).GetValue(services.Sequences)!;
        await Install(storage, test, definitions);
        var operations = test["isolatedConstraintOperations"]!.AsArray();
        if (operations.Count == 0) throw new InvalidOperationException("Field combination operations must be nonempty.");
        var outcomes = new JsonArray();
        foreach (var (operation, index) in operations.Select((value, index) => (value!, index)))
        {
            var before = await History(services.Sequences);
            var (success, sequences, violations) = await Append(services.Sequences, operation, wire["operations"]![index]!);
            var after = await History(services.Sequences);
            AssertHistory(before, after, success, operation["events"]!.AsArray().Count);
            outcomes.Add(Outcome(success, sequences, violations, (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString()));
        }
        return outcomes;
    }

    static void AssertHistory(JsonArray before, JsonArray after, bool success, int requested)
    {
        if (!success && !JsonNode.DeepEquals(before, after)) throw new InvalidOperationException("Rejected field combination changed history.");
        var expectedCount = before.Count + (success ? requested : 0);
        if (after.Count != expectedCount) throw new InvalidOperationException("Field combination history count differs from accepted requests.");
    }

    static async Task<JsonArray> History(IEventSequences sequences)
    {
        var response = await sequences.FromSequenceNumber(new FromSequenceNumberRequest
        { EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", FromEventSequenceNumber = 0 });
        if (!response.IsSuccess || response.Data is null) throw new InvalidOperationException("Field combination history read failed.");
        return new JsonArray(response.Data.Select(entry => (JsonNode?)new JsonObject
        { ["source"] = entry.Context.EventSourceId, ["sequence"] = entry.Context.SequenceNumber.ToString(),
            ["content"] = JsonNode.Parse(entry.Content), ["hash"] = entry.Context.Hash }).ToArray());
    }

    static async Task<(bool, ulong[], IEnumerable<KernelConstraints.ConstraintViolation>)> Append(IEventSequences sequences, JsonNode operation, JsonNode bytes)
    {
        if (operation["mode"]!.GetValue<string>() == "single")
        {
            var response = (await sequences.Append(Decode<AppendRequest>(bytes))).Response
                ?? throw new InvalidOperationException("Field combination single had no response.");
            if (response.Errors.Any()) throw new InvalidOperationException("Field combination single returned errors.");
            return (response.IsSuccess, [response.SequenceNumber], response.ConstraintViolations);
        }
        var batch = (await sequences.AppendManyForEventSources(Decode<AppendManyForEventSourcesRequest>(bytes))).Response
            ?? throw new InvalidOperationException("Field combination batch had no response.");
        if (batch.Errors.Any()) throw new InvalidOperationException("Field combination batch returned errors.");
        return (batch.IsSuccess, batch.SequenceNumbers.ToArray(), batch.ConstraintViolations);
    }

    static JsonObject Outcome(bool success, ulong[] sequences, IEnumerable<KernelConstraints.ConstraintViolation> violations, string next) => new()
    {
        ["success"] = success, ["sequences"] = new JsonArray(sequences.Select(number => (JsonNode?)number.ToString()).ToArray()),
        ["wireViolations"] = new JsonArray(violations.Select(violation => (JsonNode?)new JsonObject
        { ["EventTypeId"] = violation.EventTypeId, ["SequenceNumber"] = violation.SequenceNumber.ToString(),
            ["ConstraintType"] = (int)violation.ConstraintType, ["ConstraintName"] = violation.ConstraintName, ["Message"] = violation.Message,
            ["Details"] = new JsonObject(violation.Details.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value))) }).ToArray()),
        ["next"] = next
    };
}
