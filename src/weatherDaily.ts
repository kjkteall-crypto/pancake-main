import type { Item } from "./schema";

// 本地日期 YYYY-MM-DD
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 同一天 + 同一城市序号永远得到同一套天气，不会每次打开乱跳
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 按月给基准气温，夏天不会冒出 5℃ 这种不合理数字
const MONTH_HIGH = [9, 12, 17, 22, 26, 28, 30, 30, 26, 21, 16, 10];
const SUNRISE = [
  "07:35", "07:15", "06:45", "06:16", "05:56", "05:50",
  "06:00", "06:20", "06:40", "07:00", "07:20", "07:35",
];
const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DIRS = ["东北", "东", "东南", "南", "西南", "西", "西北", "北"];
const CONDITIONS: {
  name: string;
  rain: [number, number];
  humid: [number, number];
  phrase: string;
}[] = [
  { name: "晴", rain: [0, 10], humid: [35, 55], phrase: "天气晴好" },
  { name: "多云", rain: [10, 30], humid: [45, 68], phrase: "云量较多" },
  { name: "阴", rain: [20, 45], humid: [60, 80], phrase: "天色阴沉" },
  { name: "小雨", rain: [50, 75], humid: [72, 90], phrase: "有小雨" },
  { name: "阵雨", rain: [55, 85], humid: [70, 90], phrase: "午后易有阵雨" },
  { name: "雷阵雨", rain: [60, 90], humid: [72, 92], phrase: "伴有雷电" },
  { name: "雾", rain: [5, 25], humid: [82, 96], phrase: "能见度较低" },
];

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return {
    y: y || new Date().getFullYear(),
    m: Math.min(12, Math.max(1, m || 1)),
    d: d || 1,
    weekday: new Date(y || 2026, (m || 1) - 1, d || 1).getDay(),
  };
}
function shiftDate(date: string, days: number): string {
  const { y, m, d } = parse(date);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

function dayWeather(date: string, index: number) {
  const { m, weekday } = parse(date);
  const r = makeRng(hash(`${date}#${index}`));
  const high = MONTH_HIGH[m - 1] + Math.round((r() - 0.5) * 9);
  const span = 6 + Math.round(r() * 4);
  const low = high - span;
  const temp = Math.round(low + span * (0.4 + r() * 0.4));
  const cond = CONDITIONS[Math.floor(r() * CONDITIONS.length)];
  const rainPct = Math.round(
    cond.rain[0] + r() * (cond.rain[1] - cond.rain[0]),
  );
  const humid = Math.round(
    cond.humid[0] + r() * (cond.humid[1] - cond.humid[0]),
  );
  const wind = `${DIRS[Math.floor(r() * DIRS.length)]}风 ${1 + Math.floor(r() * 4)}级`;
  const aqi = 18 + Math.floor(r() * 75);
  const [sh, sm] = SUNRISE[m - 1].split(":").map(Number);
  const min = sh * 60 + sm + Math.round((r() - 0.5) * 6);
  const sunrise = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  return { high, low, temp, cond, rainPct, humid, wind, aqi, sunrise, weekday };
}

// 把静态天气条目换成按日期算出来的版本；城市名 / id / 时间等保持原样
export function applyDailyWeather(item: Item, date: string, index = 0): Item {
  const w = dayWeather(date, index);
  const hourly = ["现在", "14时", "16时", "18时", "20时"].map((time, n) => ({
    time,
    temperature: Math.round(
      w.low + (w.high - w.low) * [0.55, 0.95, 1, 0.8, 0.5][n],
    ),
    rain: `${Math.max(0, Math.min(95, w.rainPct + (n - 2) * 8))}%`,
    wind: w.wind,
  }));
  const labels = [
    "今天",
    "明天",
    "后天",
    WEEK[(w.weekday + 3) % 7],
    WEEK[(w.weekday + 4) % 7],
  ];
  const daily = labels.map((label, n) => {
    const nw = dayWeather(shiftDate(date, n), index);
    return { label, low: nw.low, high: nw.high };
  });
  const aqiLabel = w.aqi <= 50 ? "优" : w.aqi <= 100 ? "良" : "轻度污染";
  const body = `${item.title}今日${w.cond.name}，${w.low}～${w.high}℃，${w.cond.phrase}；${w.wind}，湿度 ${w.humid}%。`;
  return {
    ...item,
    body,
    meta: {
      ...item.meta,
      temperature: String(w.temp),
      high: String(w.high),
      low: String(w.low),
      condition: w.cond.name,
      humidity: `${w.humid}%`,
      sunrise: w.sunrise,
      aqi: String(w.aqi),
      aqiLabel,
      rain: `${w.rainPct}%`,
      wind: w.wind,
      hourly: JSON.stringify(hourly),
      daily: JSON.stringify(daily),
    },
  };
}
