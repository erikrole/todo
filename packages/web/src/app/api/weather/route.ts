import { ok, err } from "@/lib/api";

// WMO weather interpretation codes → short condition string
const WMO_CODES: Record<number, string> = {
  0: "clear",
  1: "mostly clear", 2: "partly cloudy", 3: "overcast",
  45: "foggy", 48: "icy fog",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain",
  71: "light snow", 73: "snow", 75: "heavy snow",
  77: "snow grains",
  80: "light showers", 81: "showers", 82: "heavy showers",
  85: "snow showers", 86: "heavy snow showers",
  95: "thunderstorm", 96: "thunderstorm with hail", 99: "severe thunderstorm",
};

export async function GET() {
  const lat = process.env.WEATHER_LAT;
  const lon = process.env.WEATHER_LON;

  if (!lat || !lon) {
    return err("No location configured", 404);
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&forecast_days=1&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    const json = await res.json();

    const tempRaw = json.current?.temperature_2m;
    const code = json.current?.weather_code ?? 0;
    const temp = tempRaw != null ? Math.round(tempRaw) : null;
    const condition = WMO_CODES[code] ?? "clear";

    // Look ahead in hourly data to see if conditions improve before noon
    const hours: number[] = json.hourly?.weather_code ?? [];
    const currentHour = new Date().getHours();
    const hoursUntilNoon = Math.max(0, 12 - currentHour);
    const futureSlice = hours.slice(currentHour + 1, currentHour + 1 + hoursUntilNoon);

    let conditionStr = condition;
    if (hoursUntilNoon > 1 && futureSlice.length > 0) {
      const futureCondition = WMO_CODES[futureSlice[futureSlice.length - 1]] ?? condition;
      if (futureCondition !== condition) {
        // Detect improvement (lower code = better weather generally)
        const isImproving =
          (futureSlice[futureSlice.length - 1] ?? 99) < (code ?? 0) ||
          (futureCondition === "clear" || futureCondition === "mostly clear" || futureCondition === "partly cloudy");
        if (isImproving) {
          conditionStr = `${condition}, clearing by noon`;
        }
      }
    }

    return ok({ temp, condition: conditionStr });
  } catch {
    return err("Failed to fetch weather", 500);
  }
}
