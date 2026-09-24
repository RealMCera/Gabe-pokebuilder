namespace GabesPokemonCreator.Api.Models;

public sealed record EncounterSuggestionDto(
    int Index,
    string Type,
    string Version,
    int Generation,
    int Species,
    int Form,
    int LevelMin,
    int LevelMax
);

public sealed record AutoLegalizeResult(
    bool Success,
    bool Legal,
    string Report,
    string[] Adjustments,
    string? FileName,
    string? DataBase64,
    EncounterSuggestionDto? Encounter
);
