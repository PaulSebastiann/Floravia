# syntax=docker/dockerfile:1
# Imagen de la API de Floravia. Se construye desde la RAÍZ del repositorio:
#   docker build -f api/Dockerfile -t floravia-api .

# ───────────── 1) Compilación ─────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Primero solo los .csproj: mientras no cambien las dependencias, Docker reutiliza la caché de "restore".
COPY core/Core.csproj core/
COPY infrastructure/Infrastructure.csproj infrastructure/
COPY application/Application.csproj application/
COPY api/Api.csproj api/
RUN dotnet restore api/Api.csproj

COPY core/ core/
COPY infrastructure/ infrastructure/
COPY application/ application/
COPY api/ api/
RUN dotnet publish api/Api.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ───────────── 2) Imagen final (solo el runtime, sin SDK) ─────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Carpeta de archivos subidos (fotos y comprobantes). Se monta como volumen para que sobreviva a los reinicios.
RUN mkdir -p /data/imagenes /data/comprobantes && chown -R $APP_UID:$APP_UID /data
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    Almacen__RutaImagenes=/data/imagenes \
    Almacen__RutaComprobantes=/data/comprobantes

VOLUME /data
EXPOSE 8080

# No corre como root.
USER $APP_UID
ENTRYPOINT ["dotnet", "Api.dll"]
