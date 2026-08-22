import axios from "axios";
import { createClient } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL || "redis://redis:6379" });
redisClient.connect().catch(console.error);

export async function getPrayerTimes(city: string, country: string, date: string) {
  const key = `prayer:${city}:${country}:${date}`;
  const cached = await redisClient.get(key);
  if (cached) return JSON.parse(cached);

  const y = date.slice(0, 4), m = date.slice(5, 7), d = date.slice(8, 10);
  const url = `https://api.aladhan.com/v1/timingsByCity/${d}-${m}-${y}?city=${encodeURIComponent(city)}&country=${country}&method=5`;
  
  try {
    const { data } = await axios.get(url, { timeout: 4000 });
    const timings = data.data.timings; // { Fajr, Dhuhr, Asr, Maghrib, Isha, Sunrise, ... }
    await redisClient.setEx(key, 26 * 3600, JSON.stringify(timings));
    return timings;
  } catch (error) {
    console.error("Failed to fetch prayer times", error);
    return null;
  }
}
