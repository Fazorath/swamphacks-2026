# 0058: Hub fetches and keeps the forecast (stretch)

**What to build:** While online, the Hub fetches a 7-day Open-Meteo forecast for the valley once an hour, keeps the last good copy on disk and serves it; other Nodes download it from the Hub like the Cache Pack. An outage never blanks it.

**Blocked by:** 0052

**Status:** done

**Owner:** refloow-0

**Spec:** `docs/specs/weather-layers.md`

- [x] The Hub fetches the same grid points as the replay file from `api.open-meteo.com/v1/forecast`, validates the shape, and writes `weather_forecast.json` atomically in `NODE_DATA_DIR`
- [x] A failed or malformed fetch leaves the file as it was and logs the cause; the loop catches every exception and logs it, and retries on the next hour
- [x] A corrupt file on disk is treated as absent and logged
- [x] `GET /api/weather/forecast` serves the file with its fetch time; 404 when there is none
- [x] A Sensor Node downloads it from the Hub's route every hour, keeps the last copy, and serves it itself
- [x] pytest: a good fetch is served; a failed fetch keeps the old copy; a corrupt file counts as absent; a Sensor serves what it downloaded after the Hub stops
- [x] Rehearsed on loopback with the Hub's source stopped (recipe in the lessons log); not a Pi check
- [x] All **Commands** pass
