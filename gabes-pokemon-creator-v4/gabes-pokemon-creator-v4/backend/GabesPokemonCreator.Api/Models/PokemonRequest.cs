namespace GabesPokemonCreator.Api.Models;

public sealed record MoveRequest(int Id, string Name);

public sealed record PokemonRequest(
    string Game,
    int SpeciesId,
    string Species,
    int Level,
    string Nature,
    int AbilityId,
    string Ability,
    int Gender,
    int ItemId,
    string Item,
    string Ball,
    bool Shiny,
    bool HiddenAbility,
    int Pokerus,
    Dictionary<string,int> Ivs,
    Dictionary<string,int> Evs,
    MoveRequest[] Moves,
    string HiddenPower,
    int MetLevel,
    int MetLocation,
    string EncounterType,
    string MetDate,
    bool Fateful,
    string DreamWorld,
    string Ot,
    int Tid,
    int Sid,
    int Language,
    int OtGender,
    int Friendship
);
