FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY GabesPokemonCreator.Api.csproj ./
RUN dotnet restore
COPY . ./
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./
ENV DOTNET_EnableDiagnostics=0
EXPOSE 10000
ENTRYPOINT ["dotnet", "GabesPokemonCreator.Api.dll"]
