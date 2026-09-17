FROM node:22-alpine AS spa
WORKDIR /src/web
COPY HorrorTracker.WebApp/package.json HorrorTracker.WebApp/package-lock.json ./
RUN npm ci
COPY HorrorTracker.WebApp/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY HorrorTracker.Api/HorrorTracker.Api.csproj HorrorTracker.Api/
COPY HorrorTracker.Data/HorrorTracker.Data.csproj HorrorTracker.Data/
COPY HorrorTracker.Utilities/HorrorTracker.Utilities.csproj HorrorTracker.Utilities/
RUN dotnet restore HorrorTracker.Api/HorrorTracker.Api.csproj
COPY HorrorTracker.Api/ HorrorTracker.Api/
COPY HorrorTracker.Data/ HorrorTracker.Data/
COPY HorrorTracker.Utilities/ HorrorTracker.Utilities/
RUN dotnet publish HorrorTracker.Api/HorrorTracker.Api.csproj -c Release -o /app/publish --no-restore -p:BuildSpaOnPublish=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
COPY --from=spa /src/web/dist ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
ENTRYPOINT ["dotnet", "HorrorTracker.Api.dll"]
