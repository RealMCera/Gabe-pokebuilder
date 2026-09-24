namespace GabesPokemonCreator.Api.Models;

public sealed record GtsQueueItem(
    string Code,
    string Status,
    string Game,
    int Generation,
    string Species,
    string FileName,
    string DataBase64,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? DeliveredAt
);

public sealed record GtsQueuePublicStatus(
    string Code,
    string Status,
    string Game,
    int Generation,
    string Species,
    string FileName,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    DateTimeOffset? DeliveredAt
);
