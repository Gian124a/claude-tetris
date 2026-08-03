---
name: clima
description: Consulta el clima actual de una ubicación (por defecto, la del usuario) usando APIs públicas gratuitas sin API key. Úsalo cuando el usuario pida el clima, la temperatura, o pregunte "qué tiempo hace", "cómo está el clima hoy", etc.
---

# Skill: Clima

Obtiene el clima actual (y opcionalmente el pronóstico) de una ciudad usando las APIs gratuitas de [Open-Meteo](https://open-meteo.com/), que no requieren API key.

## Cuándo usar

- El usuario pregunta por el clima, la temperatura o el pronóstico de una ubicación.
- El usuario no especifica ciudad: usa por defecto **Cabudare, estado Lara, Venezuela** (ubicación habitual del usuario). Si el usuario menciona otra ciudad en la conversación, usa esa en su lugar.

## Pasos

1. **Geocodificar la ciudad** (convertir nombre a coordenadas) con `WebFetch`. Si no se especificó ciudad, usa `Cabudare, Lara, Venezuela` como valor de `<CIUDAD>`:

   ```
   https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD>&count=1&language=es&format=json
   ```

   Extrae `latitude`, `longitude`, `name` y `country` del primer resultado (`results[0]`). Si no hay resultados, informa al usuario que no se encontró la ciudad y pide que la aclare.

2. **Obtener el clima actual** con `WebFetch` usando las coordenadas:

   ```
   https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto
   ```

   Esto devuelve un objeto `current` con los datos del momento.

3. **Interpretar `weather_code`** (código WMO) con esta tabla resumida:

   | Código | Descripción |
   |---|---|
   | 0 | Despejado |
   | 1–3 | Poco nuboso a nublado |
   | 45, 48 | Niebla |
   | 51–57 | Llovizna |
   | 61–67 | Lluvia |
   | 71–77 | Nieve |
   | 80–82 | Chubascos |
   | 85–86 | Chubascos de nieve |
   | 95–99 | Tormenta |

4. **Presentar el resultado** al usuario en español, de forma breve: ciudad, país, temperatura (y sensación térmica si difiere notablemente), condición general, humedad y viento. No hace falta mostrar el JSON crudo.

## Notas

- No requiere claves de API ni configuración adicional, solo acceso a internet vía `WebFetch`.
- Si el usuario pide un pronóstico de varios días, se puede añadir el parámetro `daily=temperature_2m_max,temperature_2m_min,weather_code` a la URL de forecast.
- Si `WebFetch` no está cargado aún como herramienta, cárgalo primero con `ToolSearch` (`select:WebFetch`).
