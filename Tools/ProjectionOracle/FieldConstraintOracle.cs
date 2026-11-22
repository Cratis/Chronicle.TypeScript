// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;
extern alias KernelCore;
extern alias KernelConcepts;
extern alias KernelStorage;
extern alias KernelInfrastructure;

using System.Collections.Immutable;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Chronicle.Testing.EventSequences;
using KernelContracts::Cratis.Chronicle.Contracts.Sequences;
using KernelKeyExtensions = KernelCore::Cratis.Chronicle.Events.Constraints.UniqueConstraintDefinitionExtensions;
using KernelPropertyValue = KernelCore::Cratis.Chronicle.Events.Constraints.UniqueConstraintPropertyAndValue;
using KernelServiceAccessor = KernelContracts::Cratis.Chronicle.Contracts.IChronicleServicesAccessor;
using KernelStore = KernelStorage::Cratis.Chronicle.Storage.IStorage;
using KernelUnique = KernelConcepts::Cratis.Chronicle.Concepts.Events.Constraints.UniqueConstraintDefinition;
using KernelStoreName = KernelConcepts::Cratis.Chronicle.Concepts.EventStoreName;
using KernelEventTypeId = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventTypeId;
using KernelGeneration = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventTypeGeneration;
using KernelEventType = KernelConcepts::Cratis.Chronicle.Concepts.Events.EventType;
using KernelEventTypeSchema = KernelConcepts::Cratis.Chronicle.Concepts.EventTypes.EventTypeSchema;
using KernelSchema = KernelInfrastructure::Cratis.Chronicle.Schemas.JsonSchema;

namespace ProjectionOracle;

[EventType("OracleFieldGuid")]
public record OracleFieldGuid(Guid Key);

[EventType("OracleFieldNumber")]
public record OracleFieldNumber(double Key);

[EventType("OracleFieldDouble")]
public record OracleFieldDouble(double Key);

[EventType("OracleFieldDateTime")]
public record OracleFieldDateTime(DateTime Key);

[EventType("OracleFieldText")]
public record OracleFieldText(string Key);

[EventType("OracleFieldDecimal")]
public record OracleFieldDecimal(decimal Key);

[EventType("OracleFieldFloat")]
public record OracleFieldFloat(float Key);

// Send literal JSON through the packaged service, not the .NET serializer: otherwise Guid casing,
// numeric spelling and date offsets would be normalized before the kernel ever saw the request.
internal static class FieldConstraintOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        var expectedSchemas = CheckedSchemas(fixture);
        var ignoreCasing = fixture["ignoreCasingMeasurements"]?.GetValue<bool>() == true;
        var cases = fixture["fieldConstraintCases"]!.AsArray();
        var outcomes = new JsonArray();
        foreach (var test in cases)
        {
            var type = test!["eventType"]!.GetValue<string>();
            if (expectedSchemas[type] is null || test["operations"] is not JsonArray operations || operations.Count == 0)
                throw new InvalidOperationException("Unknown or empty field constraint case.");
            const string name = "OracleFieldKey";
            var definition = new UniqueConstraintDefinition(name, _ => "", [new UniqueConstraintEventDefinition(type, ["key"])], [], ignoreCasing);
            using var scenario = new EventScenario(new OracleConstraintProvider(ImmutableArray.Create<IConstraintDefinition>(definition)));
            var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
            var services = ((KernelServiceAccessor)created[1]!).Services;
            var storage = (KernelStore)services.Sequences.GetType().GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
                .Single(field => field.FieldType == typeof(KernelStore)).GetValue(services.Sequences)!;
            var eventStore = storage.GetEventStore((KernelStoreName)"test-event-store");
            var eventTypes = eventStore.EventTypes;
            if (type == "OracleFieldNumber")
            {
                // The packaged testing adapter's Register methods are no-ops. Replace only this scenario's
                // input schema in its discovered-schema catalog, before any append, leaving kernel conversion
                // and constraint evaluation untouched. Assert the exact adapter shape and read it back below.
                var catalogField = eventTypes.GetType().GetField("_schemas", BindingFlags.Instance | BindingFlags.NonPublic);
                if (catalogField?.GetValue(eventTypes) is not Lazy<Dictionary<KernelEventType, KernelEventTypeSchema>> catalog)
                    throw new InvalidOperationException("The packaged discovered-schema catalog changed shape.");
                var registered = await eventTypes.GetFor((KernelEventTypeId)type, (KernelGeneration)1);
                var schema = new JsonObject
                {
                    ["$schema"] = "https://json-schema.org/draft/2020-12/schema", ["title"] = type, ["type"] = "object",
                    ["properties"] = new JsonObject { ["key"] = expectedSchemas[type]!.DeepClone() },
                    ["required"] = new JsonArray("key"), ["additionalProperties"] = false
                };
                catalog.Value[registered.Type] = registered with { Schema = KernelSchema.FromJson(schema.ToJsonString()) };
            }
            var effectiveSchema = await eventTypes.GetFor((KernelEventTypeId)type, (KernelGeneration)1);
            var installedProperty = JsonNode.Parse(effectiveSchema.Schema.ToJson())!["properties"]!["key"]!;
            if (!JsonNode.DeepEquals(installedProperty, fixture["fieldSchemas"]![type]))
                throw new InvalidOperationException($"Installed {type}.key schema differs from the fixture: {installedProperty.ToJsonString()}");
            var installed = (await eventStore.Constraints.GetDefinitions()).ToArray();
            if (installed is not [KernelUnique actual] || actual.Name.Value != name || actual.IgnoreCasing != ignoreCasing || actual.Scope is not null ||
                actual.RemovedWith.Any() || actual.EventDefinitions.Count() != 1 ||
                actual.EventDefinitions.Single().EventTypeId.Value != type || !actual.EventDefinitions.Single().Properties.SequenceEqual(["key"]))
                throw new InvalidOperationException("Installed field constraint differs from the requested definition.");
            var steps = new JsonArray();
            foreach (var operation in operations)
            {
                var before = await History();
                var nextBefore = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
                var entries = operation!["events"]!.AsArray();
                var events = entries.Select(entry => new EventForEventSourceId
                {
                    EventSourceId = entry!["source"]!.GetValue<string>(),
                    EventType = new KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventType { Id = type, Generation = 1 },
                    Content = entry["content"]!.GetValue<string>(), Subject = entry["source"]!.GetValue<string>()
                }).ToArray();
                bool success;
                ulong[] sequences;
                IEnumerable<KernelContracts::Cratis.Chronicle.Contracts.Events.Constraints.ConstraintViolation> violations;
                if (operation["mode"]!.GetValue<string>() == "single" && events.Length == 1)
                {
                    var response = (await services.Sequences.Append(new AppendRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log",
                        EventSourceId = events[0].EventSourceId, EventType = events[0].EventType,
                        Content = events[0].Content, Subject = events[0].Subject
                    })).Response ?? throw new InvalidOperationException("Field single request had no response.");
                    if (response.Errors.Any()) throw new InvalidOperationException("Field append returned errors.");
                    success = response.IsSuccess; sequences = [response.SequenceNumber]; violations = response.ConstraintViolations;
                }
                else if (operation["mode"]!.GetValue<string>() == "batch" && events.Length > 0)
                {
                    var response = (await services.Sequences.AppendManyForEventSources(new AppendManyForEventSourcesRequest
                    {
                        EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", Events = events
                    })).Response ?? throw new InvalidOperationException("Field batch request had no response.");
                    if (response.Errors.Any()) throw new InvalidOperationException("Field batch returned errors.");
                    success = response.IsSuccess; sequences = response.SequenceNumbers.ToArray(); violations = response.ConstraintViolations;
                }
                else throw new InvalidOperationException("Invalid field operation.");
                var history = await History();
                var next = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
                if (!success && (!violations.Any() || !JsonNode.DeepEquals(before, history) || next != nextBefore))
                    throw new InvalidOperationException("Rejected field operation changed history or had no constraint violation.");
                steps.Add(new JsonObject
                {
                    ["success"] = success,
                    ["sequences"] = new JsonArray(sequences.Select(number => (JsonNode?)JsonValue.Create(number.ToString())).ToArray()),
                    ["wireViolations"] = new JsonArray(violations.Select(violation => (JsonNode?)new JsonObject
                    {
                        ["EventTypeId"] = violation.EventTypeId, ["SequenceNumber"] = violation.SequenceNumber.ToString(),
                        ["ConstraintType"] = (int)violation.ConstraintType, ["ConstraintName"] = violation.ConstraintName,
                        ["Message"] = violation.Message,
                        ["Details"] = new JsonObject(violation.Details.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
                    }).ToArray()),
                    ["history"] = history,
                    ["next"] = next
                });
            }
            var outcome = new JsonObject { ["fieldSchema"] = installedProperty.DeepClone(), ["steps"] = steps };
            if (ignoreCasing) outcome["casingObservations"] = CasingObservations(operations);
            if (fixture["caseSensitiveTextMeasurements"]?.GetValue<bool>() == true)
                outcome["textObservations"] = TextObservations(operations);
            outcomes.Add(outcome);

            async Task<JsonArray> History()
            {
                var result = await services.Sequences.FromSequenceNumber(new FromSequenceNumberRequest
                {
                    EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", FromEventSequenceNumber = 0
                });
                if (!result.IsSuccess || result.Data is null) throw new InvalidOperationException("Field history read failed.");
                return new JsonArray(result.Data.Select(entry => (JsonNode?)new JsonObject
                {
                    ["source"] = entry.Context.EventSourceId, ["sequence"] = entry.Context.SequenceNumber.ToString(),
                    ["content"] = JsonNode.Parse(entry.Content), ["hash"] = entry.Context.Hash
                }).ToArray());
            }
        }
        return outcomes;
    }

    // The exact operation the packaged kernel applies (string.ToLowerInvariant, then UTF-8 SHA-256), observed
    // directly and cross-checked against the kernel's own key builder; never a JavaScript casing operation.
    static JsonArray CasingObservations(JsonArray operations)
    {
        var observations = new JsonArray();
        var inputs = operations.SelectMany(operation => operation!["events"]!.AsArray())
            .Select(entry => JsonNode.Parse(entry!["content"]!.GetValue<string>())!["key"]!.GetValue<string>())
            .Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal);
        foreach (var input in inputs)
        {
            var lowered = input.ToLowerInvariant();
            var direct = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(lowered)));
            var kernel = KernelKeyExtensions.GetValue([new KernelPropertyValue("key", input)], ignoreCasing: true);
            if (direct != kernel) throw new InvalidOperationException($"Kernel key builder disagrees with ToLowerInvariant for {input}.");
            observations.Add(new JsonObject
            {
                ["input"] = input, ["lowered"] = lowered, ["utf8Sha256"] = direct,
                ["scalars"] = new JsonArray(lowered.EnumerateRunes().Select(rune => (JsonNode?)JsonValue.Create(rune.Value)).ToArray())
            });
        }
        return observations;
    }

    // Observe decoded text without casing or normalization; independently verify the kernel key bytes.
    static JsonArray TextObservations(JsonArray operations)
    {
        var inputs = operations.SelectMany(operation => operation!["events"]!.AsArray())
            .Select(entry => JsonNode.Parse(entry!["content"]!.GetValue<string>())!["key"]!.GetValue<string>())
            .Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal);
        var observations = new JsonArray();
        foreach (var input in inputs)
        {
            var direct = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(input)));
            var kernel = KernelKeyExtensions.GetValue([new KernelPropertyValue("key", input)], ignoreCasing: false);
            if (direct != kernel) throw new InvalidOperationException($"Kernel key builder disagrees with UTF-8 SHA-256 for {input}.");
            observations.Add(new JsonObject
            {
                ["input"] = input, ["utf8Sha256"] = kernel,
                ["scalars"] = new JsonArray(input.EnumerateRunes().Select(rune => (JsonNode?)JsonValue.Create(rune.Value)).ToArray())
            });
        }
        return observations;
    }

    static JsonNode CheckedSchemas(JsonObject fixture)
    {
        var measurements = fixture["fieldKeyMeasurements"]?.GetValue<bool>() == true;
        var casing = fixture["ignoreCasingMeasurements"]?.GetValue<bool>() == true;
        var text = fixture["caseSensitiveTextMeasurements"]?.GetValue<bool>() == true;
        if (new[] { measurements, casing, text }.Count(enabled => enabled) > 1)
            throw new InvalidOperationException("Field measurement modes are mutually exclusive.");
        var expectedSchemas = ExpectedSchemas(measurements, casing || text);
        if (!JsonNode.DeepEquals(fixture["fieldSchemas"], expectedSchemas))
            throw new InvalidOperationException(SchemaError(measurements, casing, text));
        CheckedCases(fixture, measurements, casing, text);
        return expectedSchemas;
    }

    static JsonNode ExpectedSchemas(bool measurements, bool plainText) =>
        JsonNode.Parse(plainText ? """{"OracleFieldText":{"type":"string"}}""" : measurements ? """
            {"OracleFieldText":{"type":"string"},
             "OracleFieldDecimal":{"type":"number","format":"decimal"},
             "OracleFieldFloat":{"type":"number","format":"float"}}
            """ : """
            {"OracleFieldGuid":{"type":"string","format":"guid"},
             "OracleFieldNumber":{"type":"number"},
             "OracleFieldDouble":{"type":"number","format":"double"},
             "OracleFieldDateTime":{"type":"string","format":"date-time"}}
            """)!;

    static string SchemaError(bool measurements, bool casing, bool text)
    {
        if (casing) return "Casing fixture must declare only the plain string property schema.";
        if (text) return "Text fixture must declare only the plain string property schema.";
        return measurements ? "Field fixture must declare the measured property schemas."
            : "Field fixture must declare the TypeScript number, packaged double, Guid and DateTime property schemas.";
    }

    static void CheckedCases(JsonObject fixture, bool measurements, bool casing, bool text)
    {
        var names = fixture["fieldConstraintCases"]!.AsArray()
            .Select(test => $"{test!["eventType"]!.GetValue<string>()}/{test["kind"]!.GetValue<string>()}").ToArray();
        if (casing || text)
        {
            if (names.Length == 0 || names.Any(name => name != "OracleFieldText/oracleGuard"))
                throw new InvalidOperationException(casing ? "Casing fixture requires only plain-text oracleGuard cases."
                    : "Text fixture requires only plain-text oracleGuard cases.");
            return;
        }
        string[] expectedCases = measurements
            ? ["OracleFieldText/oracleGuard", "OracleFieldDecimal/oracleGuard", "OracleFieldFloat/oracleGuard"]
            : ["OracleFieldGuid/kernelSemantics", "OracleFieldNumber/kernelSemantics", "OracleFieldNumber/oracleGuard", "OracleFieldDateTime/oracleGuard", "OracleFieldDouble/kernelSemantics"];
        if (!names.SequenceEqual(expectedCases))
            throw new InvalidOperationException(measurements ? "Field oracle requires every declared key measurement case."
                : "Field oracle requires both supported key cases and numeric/date guards.");
    }
}
