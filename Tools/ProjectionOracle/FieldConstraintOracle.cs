// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelContracts;
extern alias KernelConcepts;
extern alias KernelStorage;

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
using KernelUnique = KernelConcepts::Cratis.Chronicle.Concepts.Events.Constraints.UniqueConstraintDefinition;
using KernelStoreName = KernelConcepts::Cratis.Chronicle.Concepts.EventStoreName;

namespace ProjectionOracle;

[EventType("OracleFieldGuid")]
public record OracleFieldGuid(Guid Key);

[EventType("OracleFieldNumber")]
public record OracleFieldNumber(double Key);

[EventType("OracleFieldDateTime")]
public record OracleFieldDateTime(DateTimeOffset Key);

// Send literal JSON through the packaged service, not the .NET serializer: otherwise Guid casing,
// numeric spelling and date offsets would be normalized before the kernel ever saw the request.
internal static class FieldConstraintOracle
{
    internal static async Task<JsonNode> Run(JsonObject fixture)
    {
        var expectedSchemas = JsonNode.Parse("""
            {"OracleFieldGuid":{"type":"string","format":"guid"},
             "OracleFieldNumber":{"type":"number","format":"double"},
             "OracleFieldDateTime":{"type":"string","format":"date-time"}}
            """)!;
        if (!JsonNode.DeepEquals(fixture["fieldSchemas"], expectedSchemas))
            throw new InvalidOperationException("Field fixture must declare the packaged event property schemas.");
        var cases = fixture["fieldConstraintCases"]!.AsArray();
        if (!cases.Select(test => $"{test!["eventType"]!.GetValue<string>()}/{test["kind"]!.GetValue<string>()}")
            .SequenceEqual(["OracleFieldGuid/kernelSemantics", "OracleFieldNumber/kernelSemantics", "OracleFieldNumber/oracleGuard", "OracleFieldDateTime/oracleGuard"]))
            throw new InvalidOperationException("Field oracle requires both supported key cases and numeric/date guards.");
        var outcomes = new JsonArray();
        foreach (var test in cases)
        {
            var type = test!["eventType"]!.GetValue<string>();
            if (expectedSchemas[type] is null || test["operations"] is not JsonArray operations || operations.Count == 0)
                throw new InvalidOperationException("Unknown or empty field constraint case.");
            const string name = "OracleFieldKey";
            var definition = new UniqueConstraintDefinition(name, _ => "", [new UniqueConstraintEventDefinition(type, ["key"])], [], false);
            using var scenario = new EventScenario(new OracleConstraintProvider(ImmutableArray.Create<IConstraintDefinition>(definition)));
            var created = (ITuple)typeof(EventScenario).GetField("_created", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(scenario)!;
            var services = ((KernelServiceAccessor)created[1]!).Services;
            var storage = (KernelStore)services.Sequences.GetType().GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
                .Single(field => field.FieldType == typeof(KernelStore)).GetValue(services.Sequences)!;
            var installed = (await storage.GetEventStore((KernelStoreName)"test-event-store").Constraints.GetDefinitions()).ToArray();
            if (installed is not [KernelUnique actual] || actual.Name.Value != name || actual.IgnoreCasing || actual.Scope is not null ||
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
            outcomes.Add(steps);

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
}
