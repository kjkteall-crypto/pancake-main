import { useEffect, useState } from "react";

/**
 * 读取玩家真机的实时状态（本地时间 + 电池）。
 * 时间用 new Date() 实时刷新；电池用 navigator.getBattery()。
 * 注意：navigator.getBattery 仅在 Chromium 内核（Chrome / Edge / Opera）可用，
 * Firefox / Safari 不支持，此时回退到传入的 fallback（story 里的固定电量）。
 */

let batteryLevel: number | null = null;
const batterySubs = new Set<(v: number | null) => void>();
let batteryStarted = false;

function startBatteryTracking() {
  if (batteryStarted) return;
  batteryStarted = true;
  const nav = navigator as unknown as {
    getBattery?: () => Promise<{
      level: number;
      addEventListener: (t: string, cb: () => void) => void;
    }>;
  };
  if (typeof nav.getBattery === "function") {
    nav
      .getBattery()
      .then((b) => {
        const update = () => {
          batteryLevel = Math.round(b.level * 100);
          batterySubs.forEach((fn) => fn(batteryLevel));
        };
        update();
        b.addEventListener("levelchange", update);
        b.addEventListener("chargingchange", update);
      })
      .catch(() => {
        batteryLevel = null;
      });
  } else {
    batteryLevel = null;
  }
}

/** 返回玩家真机电量（0–100），不支持时回退到 fallback。 */
export function useDeviceBattery(fallback: number): number {
  const [v, setV] = useState<number>(batteryLevel ?? fallback);
  useEffect(() => {
    startBatteryTracking();
    setV(batteryLevel ?? fallback);
    const sub = (val: number | null) => setV(val ?? fallback);
    batterySubs.add(sub);
    return () => {
      batterySubs.delete(sub);
    };
  }, [fallback]);
  return v;
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** 返回玩家真机的本地实时时间（HH:MM），每秒刷新。 */
export function useDeviceClock(): string {
  const [t, setT] = useState<string>(() => formatClock(new Date()));
  useEffect(() => {
    const id = setInterval(() => setT(formatClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}
