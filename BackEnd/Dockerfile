# ==== Стадия сборки ====
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Сначала только .csproj — чтобы кешировать restore отдельно от кода
COPY *.csproj ./
RUN dotnet restore

# Теперь весь код и публикация
COPY . ./
RUN dotnet publish -c Release -o /app/publish

# ==== Стадия запуска ====
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

# В контейнере ASP.NET слушает 8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BackEnd.dll"]