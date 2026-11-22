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
using KernelEventStoreStorage = KernelStorage::Cratis.Chronicle.Storage.IEventStoreStorage;
using KernelViolation = KernelContracts::Cratis.Chronicle.Contracts.Events.Constraints.ConstraintViolation;
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
    const string ConstraintName = "OracleFieldKey";

    private enum FieldMeasurementMode
    {
        Standard,
        FieldKeys,
        IgnoreCasing,
        CaseSensitiveText
    }

    private sealed record AppendOutcome(bool Success, ulong[] Sequences, IEnumerable<KernelViolation> Violations);
    private sealed record HistorySnapshot(JsonArray Events, string Next);

    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        var mode = ResolveMode(fixture);
        var expectedSchemas = CheckedSchemas(fixture, mode);
        var outcomes = new JsonArray();
        foreach (var test in fixture["fieldConstraintCases"]!.AsArray())
        {
            var type = test!["eventType"]!.GetValue<string>();
            var operations = CheckedOperations(test, expectedSchemas[type]);
            outcomes.Add(await RunCase(type, operations, expectedSchemas[type]!, mode));
        }
        return outcomes;
    }

    static JsonArray CheckedOperations(JsonNode test, JsonNode? expectedSchema)
    {
        if (expectedSchema is null) throw new InvalidOperationException("Unknown or empty field constraint case.");
        if (test["operations"] is not JsonArray operations) throw new InvalidOperationException("Unknown or empty field constraint case.");
        if (operations.Count == 0) throw new InvalidOperationException("Unknown or empty field constraint case.");
        return operations;
    }

    static async Task<JsonObject> RunCase(string type, JsonArray operations, JsonNode expectedSchema, FieldMeasurementMode mode)
    {
        var ignoreCasing = mode == FieldMeasurementMode.IgnoreCasing;
        var definition = new UniqueConstraintDefinition(ConstraintName, _ => "", [new UniqueConstraintEventDefinition(type, ["key"])], [], ignoreCasing);
        using var scenario = new EventScenario(new OracleConstraintProvider(ImmutableArray.Create<IConstraintDefinition>(definition)));
        var sequences = Sequences(scenario);
        var eventStore = EventStore(sequences);
        var installedProperty = await CheckedInstalledSchema(eventStore, type, expectedSchema);
        await CheckedInstalledConstraint(eventStore, type, ignoreCasing);
        var steps = await RunOperations(scenario, sequences, type, operations);
        var outcome = new JsonObject { ["fieldSchema"] = installedProperty.DeepClone(), ["steps"] = steps };
        AddObservations(outcome, operations, mode);
        return outcome;
    }

    static IEventSequences Sequences(EventScenario scenario)
    {
        var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
        return ((KernelServiceAccessor)created[1]!).Services.Sequences;
    }

    static KernelEventStoreStorage EventStore(IEventSequences sequences)
    {
        var storage = (KernelStore)sequences.GetType().GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
            .Single(field => field.FieldType == typeof(KernelStore)).GetValue(sequences)!;
        return storage.GetEventStore((KernelStoreName)"test-event-store");
    }

    static async Task<JsonNode> CheckedInstalledSchema(KernelEventStoreStorage eventStore, string type, JsonNode expectedSchema)
    {
        if (type == "OracleFieldNumber") await InstallNumberSchema(eventStore, type, expectedSchema);
        var effectiveSchema = await eventStore.EventTypes.GetFor((KernelEventTypeId)type, (KernelGeneration)1);
        var installedProperty = JsonNode.Parse(effectiveSchema.Schema.ToJson())!["properties"]!["key"]!;
        if (!JsonNode.DeepEquals(installedProperty, expectedSchema))
            throw new InvalidOperationException($"Installed {type}.key schema differs from the fixture: {installedProperty.ToJsonString()}");
        return installedProperty;
    }

    static async Task InstallNumberSchema(KernelEventStoreStorage eventStore, string type, JsonNode expectedSchema)
    {
        // The packaged testing adapter's Register methods are no-ops. Replace only this scenario's
        // input schema in its discovered-schema catalog, before any append, leaving kernel conversion
        // and constraint evaluation untouched. Assert the exact adapter shape and read it back above.
        var eventTypes = eventStore.EventTypes;
        var catalogField = eventTypes.GetType().GetField("_schemas", BindingFlags.Instance | BindingFlags.NonPublic);
        if (catalogField?.GetValue(eventTypes) is not Lazy<Dictionary<KernelEventType, KernelEventTypeSchema>> catalog)
            throw new InvalidOperationException("The packaged discovered-schema catalog changed shape.");
        var registered = await eventTypes.GetFor((KernelEventTypeId)type, (KernelGeneration)1);
        var schema = new JsonObject
        {
            ["$schema"] = "https://json-schema.org/draft/2020-12/schema", ["title"] = type, ["type"] = "object",
            ["properties"] = new JsonObject { ["key"] = expectedSchema.DeepClone() },
            ["required"] = new JsonArray("key"), ["additionalProperties"] = false
        };
        catalog.Value[registered.Type] = registered with { Schema = KernelSchema.FromJson(schema.ToJsonString()) };
    }

    static async Task CheckedInstalledConstraint(KernelEventStoreStorage eventStore, string type, bool ignoreCasing)
    {
        var installed = (await eventStore.Constraints.GetDefinitions()).ToArray();
        if (installed is not [KernelUnique actual])
            throw new InvalidOperationException("Installed field constraint differs from the requested definition.");
        if (!MatchesDefinition(actual, type, ignoreCasing))
            throw new InvalidOperationException("Installed field constraint differs from the requested definition.");
    }

    static bool MatchesDefinition(KernelUnique actual, string type, bool ignoreCasing) =>
        actual.Name.Value == ConstraintName && actual.IgnoreCasing == ignoreCasing && actual.Scope is null &&
        !actual.RemovedWith.Any() && CoversProperty(actual, type);

    static bool CoversProperty(KernelUnique actual, string type) =>
        actual.EventDefinitions.Count() == 1 && actual.EventDefinitions.Single().EventTypeId.Value == type &&
        actual.EventDefinitions.Single().Properties.SequenceEqual(["key"]);

    static async Task<JsonArray> RunOperations(EventScenario scenario, IEventSequences sequences, string type, JsonArray operations)
    {
        var steps = new JsonArray();
        foreach (var operation in operations)
        {
            var before = await Snapshot(scenario, sequences);
            var outcome = await Append(sequences, type, operation!);
            var after = await Snapshot(scenario, sequences);
            CheckedRollback(outcome, before, after);
            steps.Add(Outcome(outcome, after));
        }
        return steps;
    }

    static async Task<HistorySnapshot> Snapshot(EventScenario scenario, IEventSequences sequences)
    {
        var history = await History(sequences);
        var next = (await scenario.EventLog.GetNextSequenceNumber()).Value.ToString();
        return new HistorySnapshot(history, next);
    }

    static async Task<JsonArray> History(IEventSequences sequences)
    {
        var result = await sequences.FromSequenceNumber(new FromSequenceNumberRequest
        {
            EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", FromEventSequenceNumber = 0
        });
        if (!result.IsSuccess) throw new InvalidOperationException("Field history read failed.");
        if (result.Data is null) throw new InvalidOperationException("Field history read failed.");
        return new JsonArray(result.Data.Select(entry => (JsonNode?)new JsonObject
        {
            ["source"] = entry.Context.EventSourceId, ["sequence"] = entry.Context.SequenceNumber.ToString(),
            ["content"] = JsonNode.Parse(entry.Content), ["hash"] = entry.Context.Hash
        }).ToArray());
    }

    static async Task<AppendOutcome> Append(IEventSequences sequences, string type, JsonNode operation)
    {
        var events = operation["events"]!.AsArray().Select(entry => new EventForEventSourceId
        {
            EventSourceId = entry!["source"]!.GetValue<string>(),
            EventType = new KernelContracts::Cratis.Chronicle.Contracts.Sequences.EventType { Id = type, Generation = 1 },
            Content = entry["content"]!.GetValue<string>(), Subject = entry["source"]!.GetValue<string>()
        }).ToArray();
        return (operation["mode"]!.GetValue<string>(), events.Length) switch
        {
            ("single", 1) => await AppendSingle(sequences, events[0]),
            ("batch", > 0) => await AppendBatch(sequences, events),
            _ => throw new InvalidOperationException("Invalid field operation.")
        };
    }

    static async Task<AppendOutcome> AppendSingle(IEventSequences sequences, EventForEventSourceId entry)
    {
        var response = (await sequences.Append(new AppendRequest
        {
            EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log",
            EventSourceId = entry.EventSourceId, EventType = entry.EventType, Content = entry.Content, Subject = entry.Subject
        })).Response ?? throw new InvalidOperationException("Field single request had no response.");
        if (response.Errors.Any()) throw new InvalidOperationException("Field append returned errors.");
        return new AppendOutcome(response.IsSuccess, [response.SequenceNumber], response.ConstraintViolations);
    }

    static async Task<AppendOutcome> AppendBatch(IEventSequences sequences, EventForEventSourceId[] events)
    {
        var response = (await sequences.AppendManyForEventSources(new AppendManyForEventSourcesRequest
        {
            EventStore = "test-event-store", Namespace = "default", EventSequenceId = "event-log", Events = events
        })).Response ?? throw new InvalidOperationException("Field batch request had no response.");
        if (response.Errors.Any()) throw new InvalidOperationException("Field batch returned errors.");
        return new AppendOutcome(response.IsSuccess, response.SequenceNumbers.ToArray(), response.ConstraintViolations);
    }

    static void CheckedRollback(AppendOutcome outcome, HistorySnapshot before, HistorySnapshot after)
    {
        if (outcome.Success) return;
        if (!outcome.Violations.Any()) throw new InvalidOperationException("Rejected field operation changed history or had no constraint violation.");
        if (!JsonNode.DeepEquals(before.Events, after.Events)) throw new InvalidOperationException("Rejected field operation changed history or had no constraint violation.");
        if (after.Next != before.Next) throw new InvalidOperationException("Rejected field operation changed history or had no constraint violation.");
    }

    static JsonObject Outcome(AppendOutcome outcome, HistorySnapshot after) => new()
    {
        ["success"] = outcome.Success,
        ["sequences"] = new JsonArray(outcome.Sequences.Select(number => (JsonNode?)JsonValue.Create(number.ToString())).ToArray()),
        ["wireViolations"] = new JsonArray(outcome.Violations.Select(violation => (JsonNode?)new JsonObject
        {
            ["EventTypeId"] = violation.EventTypeId, ["SequenceNumber"] = violation.SequenceNumber.ToString(),
            ["ConstraintType"] = (int)violation.ConstraintType, ["ConstraintName"] = violation.ConstraintName,
            ["Message"] = violation.Message,
            ["Details"] = new JsonObject(violation.Details.ToDictionary(pair => pair.Key, pair => (JsonNode?)JsonValue.Create(pair.Value)))
        }).ToArray()),
        ["history"] = after.Events,
        ["next"] = after.Next
    };

    static void AddObservations(JsonObject outcome, JsonArray operations, FieldMeasurementMode mode)
    {
        var property = mode switch
        {
            FieldMeasurementMode.IgnoreCasing => "casingObservations",
            FieldMeasurementMode.CaseSensitiveText => "textObservations",
            _ => null
        };
        if (property is null) return;
        var inputs = operations.SelectMany(operation => operation!["events"]!.AsArray())
            .Select(entry => JsonNode.Parse(entry!["content"]!.GetValue<string>())!["key"]!.GetValue<string>())
            .Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal);
        outcome[property] = new JsonArray(inputs.Select(input => (JsonNode?)Observation(input, mode)).ToArray());
    }

    // Observe the exact kernel operation: optional ToLowerInvariant, then UTF-8 SHA-256, never normalization.
    // Cross-check the independently hashed text against the kernel's own key builder, not JavaScript casing.
    static JsonObject Observation(string input, FieldMeasurementMode mode)
    {
        var ignoreCasing = mode == FieldMeasurementMode.IgnoreCasing;
        var text = ignoreCasing ? input.ToLowerInvariant() : input;
        var direct = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text)));
        var kernel = KernelKeyExtensions.GetValue([new KernelPropertyValue("key", input)], ignoreCasing);
        if (direct != kernel) throw new InvalidOperationException(ObservationError(input, mode));
        var observation = new JsonObject { ["input"] = input };
        if (ignoreCasing) observation["lowered"] = text;
        observation["utf8Sha256"] = direct;
        observation["scalars"] = new JsonArray(text.EnumerateRunes().Select(rune => (JsonNode?)JsonValue.Create(rune.Value)).ToArray());
        return observation;
    }

    static string ObservationError(string input, FieldMeasurementMode mode) => mode switch
    {
        FieldMeasurementMode.IgnoreCasing => $"Kernel key builder disagrees with ToLowerInvariant for {input}.",
        _ => $"Kernel key builder disagrees with UTF-8 SHA-256 for {input}."
    };

    static FieldMeasurementMode ResolveMode(JsonObject fixture)
    {
        (string Flag, FieldMeasurementMode Mode)[] declarations =
        [
            ("fieldKeyMeasurements", FieldMeasurementMode.FieldKeys),
            ("ignoreCasingMeasurements", FieldMeasurementMode.IgnoreCasing),
            ("caseSensitiveTextMeasurements", FieldMeasurementMode.CaseSensitiveText)
        ];
        var modes = declarations.Where(item => fixture[item.Flag]?.GetValue<bool>() == true).Select(item => item.Mode).ToArray();
        return modes.Length switch
        {
            0 => FieldMeasurementMode.Standard,
            1 => modes[0],
            _ => throw new InvalidOperationException("Field measurement modes are mutually exclusive.")
        };
    }

    static JsonNode CheckedSchemas(JsonObject fixture, FieldMeasurementMode mode)
    {
        var expectedSchemas = ExpectedSchemas(mode);
        if (!JsonNode.DeepEquals(fixture["fieldSchemas"], expectedSchemas))
            throw new InvalidOperationException(SchemaError(mode));
        CheckedCases(fixture, mode);
        return expectedSchemas;
    }

    static JsonNode ExpectedSchemas(FieldMeasurementMode mode) => JsonNode.Parse(mode switch
    {
        FieldMeasurementMode.IgnoreCasing or FieldMeasurementMode.CaseSensitiveText => """{"OracleFieldText":{"type":"string"}}""",
        FieldMeasurementMode.FieldKeys => """
            {"OracleFieldText":{"type":"string"},
             "OracleFieldDecimal":{"type":"number","format":"decimal"},
             "OracleFieldFloat":{"type":"number","format":"float"}}
            """,
        _ => """
            {"OracleFieldGuid":{"type":"string","format":"guid"},
             "OracleFieldNumber":{"type":"number"},
             "OracleFieldDouble":{"type":"number","format":"double"},
             "OracleFieldDateTime":{"type":"string","format":"date-time"}}
            """
    })!;

    static string SchemaError(FieldMeasurementMode mode) => mode switch
    {
        FieldMeasurementMode.IgnoreCasing => "Casing fixture must declare only the plain string property schema.",
        FieldMeasurementMode.CaseSensitiveText => "Text fixture must declare only the plain string property schema.",
        FieldMeasurementMode.FieldKeys => "Field fixture must declare the measured property schemas.",
        _ => "Field fixture must declare the TypeScript number, packaged double, Guid and DateTime property schemas."
    };

    static void CheckedCases(JsonObject fixture, FieldMeasurementMode mode)
    {
        var names = fixture["fieldConstraintCases"]!.AsArray()
            .Select(test => $"{test!["eventType"]!.GetValue<string>()}/{test["kind"]!.GetValue<string>()}").ToArray();
        var valid = mode switch
        {
            FieldMeasurementMode.IgnoreCasing or FieldMeasurementMode.CaseSensitiveText =>
                names.Length > 0 && names.All(name => name == "OracleFieldText/oracleGuard"),
            FieldMeasurementMode.FieldKeys =>
                names.SequenceEqual(["OracleFieldText/oracleGuard", "OracleFieldDecimal/oracleGuard", "OracleFieldFloat/oracleGuard"]),
            _ => names.SequenceEqual(["OracleFieldGuid/kernelSemantics", "OracleFieldNumber/kernelSemantics", "OracleFieldNumber/oracleGuard", "OracleFieldDateTime/oracleGuard", "OracleFieldDouble/kernelSemantics"])
        };
        if (!valid) throw new InvalidOperationException(CaseError(mode));
    }

    static string CaseError(FieldMeasurementMode mode) => mode switch
    {
        FieldMeasurementMode.IgnoreCasing => "Casing fixture requires only plain-text oracleGuard cases.",
        FieldMeasurementMode.CaseSensitiveText => "Text fixture requires only plain-text oracleGuard cases.",
        FieldMeasurementMode.FieldKeys => "Field oracle requires every declared key measurement case.",
        _ => "Field oracle requires both supported key cases and numeric/date guards."
    };
}
