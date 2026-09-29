// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

extern alias KernelConcepts;

using System.Globalization;
using System.Reflection;
using System.Security.Cryptography;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using KernelDefinition = KernelConcepts::Cratis.Chronicle.Concepts.Projections.Definitions.ProjectionDefinition;

namespace ProjectionOracle;

internal static class Program
{
    static async Task<int> Main(string[] args)
    {
        Environment.SetEnvironmentVariable("TZ", "UTC");
        TimeZoneInfo.ClearCachedData();
        CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
        CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;
        try
        {
            ProjectionDefinitionBridge.SmokeTest();
            var information = typeof(KernelDefinition).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
                ?? throw new InvalidOperationException("Packaged Chronicle engine has no AssemblyInformationalVersion.");
            var versionParts = information.Split('+', 2);
            if (versionParts.Length != 2 || versionParts[1].Length < 7)
            {
                throw new InvalidOperationException($"Unexpected packaged Chronicle version: {information}");
            }
            Console.WriteLine($"Chronicle {versionParts[0]} ({versionParts[1][..7]}) converter signature: OK");
            if (args is ["--smoke"])
            {
                return 0;
            }
            if (args is not ["--check"] and not ["--update"] and not ["--update-events"] and not ["--probe", _])
            {
                Console.Error.WriteLine("Usage: ProjectionOracle --smoke | --check | --update | --update-events | --probe VERSION (run from the repository root)");
                return 2;
            }
            if (args is ["--probe", var release] && versionParts[0] != release)
            {
                throw new InvalidOperationException($"Probe requested {release} but loaded Chronicle {information}.");
            }
            var package = Path.Combine("node_modules", "@cratis", "chronicle.contracts");
            var descriptor = Path.Combine(package, "generated", "projections.ts");
            if (!File.Exists(descriptor))
            {
                throw new FileNotFoundException("Install pinned Yarn dependencies before checking the contracts descriptor.", descriptor);
            }
            var contracts = JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(package, "package.json")))!["version"]!.GetValue<string>();
            var hash = Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(descriptor)));
            var projectionFiles = args[0] == "--update-events"
                ? []
                : Directory.GetFiles(Path.Combine("Source", "testing", "projections", "fixtures"), "*.json");
            var eventFiles = Directory.GetFiles(Path.Combine("Source", "testing", "fixtures"), "*.json");
            foreach (var required in new[] { "constraints.json", "constraints-isolation.json", "constraints-key-domain.json", "constraints-property-lifecycle.json", "constraints-property-covered-removal.json", "constraints-event-type-cycles.json", "constraints-event-type-siblings.json", "constraints-composite.json", "constraints-ignore-casing.json" })
            {
                if (!eventFiles.Contains(Path.Combine("Source", "testing", "fixtures", required)))
                    throw new InvalidOperationException($"Event oracle requires {required}; refusing a vacuous check.");
            }
            if (eventFiles.Length < 4)
            {
                throw new InvalidOperationException("Event oracle requires at least four fixtures; refusing a vacuous check.");
            }
            if (args[0] != "--update-events" && projectionFiles.Length < 5)
            {
                throw new InvalidOperationException("Projection oracle requires at least five fixtures; refusing a vacuous check.");
            }
            var files = projectionFiles
                .Concat(eventFiles)
                .OrderBy(name => name, StringComparer.Ordinal).ToArray();
            var drift = 0;
            foreach (var path in files)
            {
                var fixture = JsonNode.Parse(await File.ReadAllTextAsync(path))!.AsObject();
                var fixtureCommit = fixture["chronicle"]?["commit"]?.GetValue<string>();
                var kind = fixture["kind"]?.GetValue<string>();
                if (eventFiles.Contains(path) && fixture["oracle"]?.GetValue<string>() != "eventScenario")
                {
                    throw new InvalidOperationException($"{path}: event fixture must use the packaged kernel EventScenario oracle.");
                }
                if (kind is not ("kernelSemantics" or "oracleGuard"))
                {
                    throw new InvalidOperationException($"{path}: kind must be 'kernelSemantics' or 'oracleGuard'.");
                }
                if (fixture["constraintDefinitions"] is not null && fixture["constraintDescriptorSha256"]?.GetValue<string>() !=
                    Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(Path.Combine(package, "generated", "events_constraints.ts")))))
                    throw new InvalidOperationException($"{path}: constraint contract descriptor does not match installed TypeScript contracts.");
                if (fixture["formatVersion"]?.GetValue<int>() != 1 ||
                    (args[0] != "--probe" && (fixture["chronicle"]?["version"]?.GetValue<string>() != versionParts[0] ||
                     fixtureCommit is null || fixtureCommit.Length < 7 || !versionParts[1].StartsWith(fixtureCommit, StringComparison.OrdinalIgnoreCase))) ||
                    fixture["tsContracts"]?["version"]?.GetValue<string>() != contracts ||
                    fixture["tsContracts"]?["descriptorSha256"]?.GetValue<string>() !=
                        (fixture["oracle"]?.GetValue<string>() == "eventScenario"
                            ? Convert.ToHexStringLower(SHA256.HashData(File.ReadAllBytes(Path.Combine(package, "generated", "sequences.ts"))))
                            : hash))
                {
                    throw new InvalidOperationException($"{path}: fixture version/hash does not match loaded engine and installed TypeScript contracts.");
                }
                var actual = fixture["oracle"]?.GetValue<string>() == "eventScenario"
                    ? await EventScenarioOracle.Run(fixture)
                    : await OracleRunner.Run(fixture);
                if (args[0] is "--update" or "--update-events")
                {
                    fixture["expected"] = actual;
                    await File.WriteAllTextAsync(path, fixture.ToJsonString(new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping }) + "\n");
                }
                else if (!JsonNode.DeepEquals(fixture["expected"], actual))
                {
                    Console.Error.WriteLine($"{path}: drift\nexpected: {fixture["expected"]?.ToJsonString()}\nactual:   {actual.ToJsonString()}");
                    drift++;
                }
                else
                {
                    Console.WriteLine($"{path}: OK");
                }
            }
            if (drift != 0)
            {
                if (args[0] == "--probe")
                {
                    Console.WriteLine($"::warning::{drift} oracle fixture(s) differ on Chronicle {information}; pin unchanged.");
                }
                else
                {
                    throw new InvalidOperationException($"{drift} oracle fixture(s) drifted; review production semantics before regenerating expectations.");
                }
            }
            return 0;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(exception);
            return 1;
        }
    }
}
