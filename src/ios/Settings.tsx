import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type ChangeEvent,
  type ComponentType,
} from "react";
import { useDeviceBattery, useDeviceClock } from "../deviceStatus";
import {
  Plane,
  Wifi,
  Bluetooth,
  Signal,
  Battery,
  Settings,
  Accessibility,
  Image,
  Bell,
  Volume2,
  Moon,
  Shield,
  ChevronRight,
  Search,
  Check,
  Plus,
  Link,
  Globe,
  Mic,
} from "lucide-react";
import type { Work, Item, UiValue } from "../schema";
import {
  BUILTIN_PHOTOS,
  CSS_WALLPAPERS,
  UPLOAD_PREFIX,
  isUpload,
  wallpaperClass,
  wallpaperImage,
} from "../wallpaper";
import { IOSToggle } from "../vendor/konsta/Toggle";
import { NavigationPage, useNavigation } from "./Navigation";
type Row = [ComponentType<{ size?: number }>, string, string];
// 把 2026-11-07 格式化成 “2026年11月7日”
function formatCNDate(s: string): string {
  const [y, m, d] = s.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
// 解析 "YYYY-MM-DD"
function parseYMD(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-");
  return { y: Number(y), m: Number(m), d: Number(d) };
}
// 某年某月的天数（2 月按闰年处理：能被 4 整除且不被 100 整除，或能被 400 整除为闰年）
function daysInMonth(y: number, m: number): number {
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
const WHEEL_ITEM_H = 36;
const WHEEL_VISIBLE = 5;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
// iOS 风格滚动选择器（滚轮）：上下滑动选数字，中间高亮选中
function Wheel({
  value,
  options,
  onChange,
  format,
  width,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  format?: (v: number) => string;
  width: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pad = Math.floor(WHEEL_VISIBLE / 2) * WHEEL_ITEM_H;
  // 选项或外部值变化时，把滚轮重新对准当前值（初始定位 / 月份切换导致天数变化等）
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.max(0, options.indexOf(value));
    el.scrollTop = idx * WHEEL_ITEM_H;
  }, [options, value]);
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const idx = Math.round(el.scrollTop / WHEEL_ITEM_H);
      const clamped = Math.max(0, Math.min(options.length - 1, idx));
      const v = options[clamped];
      if (v !== value) onChange(v);
    }, 80);
  };
  return (
    <div className="wheel" style={{ height: WHEEL_ITEM_H * WHEEL_VISIBLE, width }}>
      <div
        className="wheel-track"
        ref={trackRef}
        onScroll={onScroll}
        style={{ paddingTop: pad, paddingBottom: pad }}
      >
        {options.map((o) => (
          <div
            key={o}
            className={"wheel-item" + (o === value ? " active" : "")}
            style={{ height: WHEEL_ITEM_H }}
          >
            {format ? format(o) : o}
          </div>
        ))}
      </div>
    </div>
  );
}
const groups: Row[][] = [
  [
    [Plane, "飞行模式", "#ff9500"],
    [Wifi, "无线局域网", "#007aff"],
    [Bluetooth, "蓝牙", "#007aff"],
    [Signal, "蜂窝网络", "#34c759"],
    [Link, "个人热点", "#65ce88"],
    [Battery, "电池", "#34c759"],
    [Globe, "VPN", "#007aff"],
  ],
  [
    [Settings, "通用", "#8e8e93"],
    [Accessibility, "辅助功能", "#007aff"],
    [Image, "墙纸", "#32ade6"],
  ],
  [
    [Bell, "通知", "#ff3b30"],
    [Volume2, "声音与触感", "#ff2d55"],
    [Moon, "专注模式", "#5856d6"],
    [Shield, "面容 ID 与密码", "#34c759"],
  ],
];
export function NativeSettings({
  work,
  items,
  creator,
  onItem,
  onSettings,
  onUi,
  onOpen,
  rewind = "",
  clock = "",
  wallpaper,
}: {
  work: Work;
  items: Item[];
  creator: boolean;
  onItem: (i: Item) => void;
  onSettings?: () => void;
  onUi?: (key: string, value: UiValue) => void;
  onOpen?: (app: string) => void;
  rewind?: string;
  clock?: string;
  wallpaper?: string;
}) {
  const liveBattery = useDeviceBattery(work.phone.battery);
  const [picker, setPicker] = useState<{ y: number; m: number; d: number }>({
    y: 2025,
    m: 1,
    d: 1,
  });
  const [showRewind, setShowRewind] = useState(false);
  const liveClock = useDeviceClock();
  const [showClock, setShowClock] = useState(false);
  const [clockPicker, setClockPicker] = useState({ h: 0, m: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    [],
  );
  const dayOptions = useMemo(
    () => Array.from({ length: daysInMonth(picker.y, picker.m) }, (_, i) => i + 1),
    [picker.y, picker.m],
  );
  const nav = useNavigation(),
    [query, setQuery] = useState(""),
    [airplane, setAirplane] = useState(false),
    [wifi, setWifi] = useState(true),
    [bluetooth, setBluetooth] = useState(true),
    [lowPower, setLowPower] = useState(false);
  const row = (
    label: string,
    value?: string,
    click?: () => void,
    reserveArrow = false,
  ) => (
    <button key={label} className="settings-native-row" onClick={click}>
      <span>{label}</span>
      <span className="settings-detail-value">{value}</span>
      {(click || reserveArrow) && (
        <ChevronRight
          size={16}
          style={click ? undefined : { visibility: "hidden" }}
        />
      )}
    </button>
  );
  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <div className="settings-native-row">
      <span>{label}</span>
      <IOSToggle label={label} checked={value} onChange={set} />
    </div>
  );
  // 选一张本地图片：先缩到最长边 1280，再压成较小的 JPEG，避免存档过大
  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("请选择图片文件");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setUploadError("图片读取失败，换一张试试");
    reader.onload = () => {
      const img = document.createElement("img");
      img.onerror = () => setUploadError("图片读取失败，换一张试试");
      img.onload = () => {
        try {
          const max = 1280;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("no canvas");
          ctx.drawImage(img, 0, 0, w, h);
          onUi?.(
            "wallpaper",
            UPLOAD_PREFIX + canvas.toDataURL("image/jpeg", 0.82),
          );
          setUploadError("");
        } catch {
          setUploadError("这张图片无法使用，换一张试试");
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const openClockPicker = () => {
    if (!rewind) return; // Time is locked while Auto is on.
    const [h, m] = (clock || liveClock).split(":").map(Number);
    setClockPicker({
      h: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0,
      m: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0,
    });
    setShowClock(true);
  };
  // Keep follow-real-time behavior available without showing it in the UI.
  const resetClock = () => onUi?.("clock", "");
  const sub = () => {
    switch (nav.page) {
      case "通用":
        return (
          <div className="settings-group">
            {row("关于本机", "", () => nav.push("关于本机"))}
            {row("软件更新", "iOS 18.0", () => nav.push("软件更新"))}
            {row("iPhone 储存空间", "", () => nav.push("iPhone 储存空间"))}
            {row("日期与时间", "", () => nav.push("日期与时间"))}
            {row("语言与地区", "简体中文", () => nav.push("语言与地区"))}
          </div>
        );
      case "墙纸": {
        const current = wallpaper || work.phone.wallpaper;
        const thumb = (id: string, name: string) => {
          const chosen = current === id;
          return (
            <button
              key={id}
              className={`wallpaper-choice ${chosen ? "is-current" : ""}`}
              onClick={() => onUi?.("wallpaper", id)}
            >
              <span
                className={`wallpaper-thumb ${wallpaperClass(id)}`}
                style={wallpaperImage(id)}
              >
                {chosen && <Check size={18} />}
              </span>
              <small>{name}</small>
            </button>
          );
        };
        return (
          <div className="wallpaper-picker">
            <div
              className={`wallpaper-preview ${wallpaperClass(current)}`}
              style={wallpaperImage(current)}
            />
            <button
              className={`wallpaper-upload-btn ${isUpload(current) ? "is-current" : ""}`}
              onClick={() => fileRef.current?.click()}
            >
              {isUpload(current) ? (
                <span
                  className={`wallpaper-upload-mini ${wallpaperClass(current)}`}
                  style={wallpaperImage(current)}
                />
              ) : (
                <Plus size={20} />
              )}
              <span>{isUpload(current) ? "更换我的图片" : "上传图片"}</span>
              {isUpload(current) && <Check size={18} />}
            </button>
            <div className="wallpaper-choices">
              {CSS_WALLPAPERS.map((w) => thumb(w.id, w.name))}
              {BUILTIN_PHOTOS.map((w) => thumb(w.id, w.name))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleUpload}
            />
            {uploadError && <p className="wallpaper-error">{uploadError}</p>}
          </div>
        );
      }
      case "辅助功能":
        return (
          <div className="settings-group">
            {row("App Store", "", () => onOpen?.("appstore"))}
            <p className="settings-page-caption">
              已隐藏的 App 可在「辅助功能」中打开。
            </p>
          </div>
        );
      case "关于本机":
        return (
          <div className="settings-group">
            {row("名称", work.phone.owner + "的 iPhone")}
            {row("iOS 版本", "18.0")}
            {row("机型名称", "iPhone 15 Pro")}
            {row("照片", String(work.data.photos?.length || 0))}
            {row(
              "应用程序",
              String(work.apps.filter((a) => a.installed).length),
            )}
          </div>
        );
      case "Wi-Fi":
      case "无线局域网":
        return (
          <>
            <div className="settings-group">
              {toggle("Wi-Fi", wifi, setWifi)}
            </div>
            {wifi && (
              <>
                <p className="settings-section-label">我的网络</p>
                <div className="settings-group">
                  <div className="settings-native-row">
                    <Check size={18} color="#007aff" />
                    <span>{work.phone.network}</span>
                    <Wifi size={18} />
                  </div>
                </div>
                <p className="settings-page-caption">
                  连接状态仅用于作品中的虚拟手机。
                </p>
              </>
            )}
          </>
        );
      case "蓝牙":
        return (
          <>
            <div className="settings-group">
              {toggle("蓝牙", bluetooth, setBluetooth)}
            </div>
            <p className="settings-page-caption">
              {bluetooth ? "我的设备" : "蓝牙已关闭"}
            </p>
          </>
        );
      case "电池":
        return (
          <>
            <div className="settings-group">
              {row("电池电量", liveBattery + "%")}
              {toggle("低电量模式", lowPower, setLowPower)}
            </div>
            <p className="settings-page-caption">
              低电量模式仅改变虚拟设备状态。
            </p>
          </>
        );
      case "日期与时间": {
        const autoOn = !rewind;
        const openPicker = () => {
          setPicker(parseYMD(rewind || today));
          setShowRewind(true);
        };
        return (
          <div className="settings-group">
            {toggle("自动设置", autoOn, (v) => {
              if (v) {
                onUi?.("rewind", "");
                resetClock();
              } else openPicker();
            })}
            {row("时区", "中国标准时间", undefined, true)}
            {row(
              "日期",
              autoOn
                ? formatCNDate(today)
                : rewind
                  ? formatCNDate(rewind)
                  : "未设置",
              autoOn ? undefined : openPicker,
              true,
            )}
            {row(
              "时间",
              clock || liveClock,
              autoOn ? undefined : openClockPicker,
              true,
            )}
          </div>
        );
      }
      case "iPhone 储存空间":
        return (
          <div className="settings-group">
            {work.apps
              .filter((a) => a.installed)
              .map((a) => row(a.name, `${work.data[a.id]?.length || 0} 项`))}
          </div>
        );
      case "软件更新":
        return (
          <p className="settings-page-caption">
            iOS 18.0 · 此为作品中的虚拟系统，不下载系统更新。
          </p>
        );
      default:
        return (
          <>
            <div className="settings-group">
              {row(
                nav.page,
                nav.page === "面容 ID 与密码"
                  ? work.phone.passcode
                    ? "已设置密码"
                    : "未设置密码"
                  : "",
              )}
            </div>
            {!items.some((i) => i.folder === nav.page) && (
              <p className="settings-page-caption">此作品没有配置更多选项。</p>
            )}
          </>
        );
    }
  };
  return (
    <div className="native-settings" data-root={!nav.page}>
      <NavigationPage
        page={nav.page}
        back={nav.pop}
        title={nav.depth > 1 ? "通用" : "设置"}
      >
        {nav.page ? (
          sub()
        ) : (
          <>
            <h1>设置</h1>
            {!query && (
              <button
                className="settings-account"
                onClick={() => nav.push(work.phone.owner)}
              >
                <span>{work.phone.owner.slice(0, 1)}</span>
                <div>
                  <strong>{work.phone.owner}</strong>
                  <small>Apple 账户、iCloud 与更多</small>
                </div>
                <ChevronRight size={17} />
              </button>
            )}
            {groups.map((group, n) => (
              <div className="settings-group" key={n}>
                {group
                  .filter(([, name]) => name.includes(query))
                  .map(([Icon, name, color]) => (
                    <div
                      key={name}
                      className="settings-native-row"
                      role={name === "飞行模式" ? undefined : "button"}
                      tabIndex={name === "飞行模式" ? undefined : 0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") nav.push(name);
                      }}
                      onClick={() => {
                        if (name !== "飞行模式") nav.push(name);
                      }}
                    >
                      <span
                        className="settings-glyph"
                        style={{ background: color }}
                      >
                        <Icon size={21} />
                      </span>
                      <span>{name}</span>
                      {name === "飞行模式" ? (
                        <IOSToggle
                          label="飞行模式"
                          checked={airplane}
                          onChange={setAirplane}
                        />
                      ) : (
                        <>
                          <small>
                            {name === "无线局域网"
                              ? wifi
                                ? "未连接"
                                : "关闭"
                              : name === "蓝牙"
                                ? bluetooth
                                  ? "打开"
                                  : "关闭"
                                : name === "VPN"
                                  ? "未连接"
                                  : name === "蜂窝网络" || name === "个人热点"
                                    ? "关闭"
                                    : ""}
                          </small>
                          <ChevronRight size={16} />
                        </>
                      )}
                    </div>
                  ))}
              </div>
            ))}
          </>
        )}
        {items
          .filter(
            (i) =>
              !nav.page || i.folder === nav.page || i.title.includes(nav.page),
          )
          .map((i) => (
            <button className="record-row" key={i.id} onClick={() => onItem(i)}>
              {i.title}
              <ChevronRight size={16} />
            </button>
          ))}
        {creator && (
          <button className="phone-add" onClick={onSettings}>
            编辑系统配置
          </button>
        )}
      </NavigationPage>
      {!nav.page && (
        <label className="settings-search">
          <Search size={23} />
          <input
            aria-label="搜索设置"
            placeholder="搜索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Mic size={22} aria-hidden="true" />
        </label>
      )}
      {showRewind && (
        <div
          className="rewind-sheet-backdrop"
          onClick={() => setShowRewind(false)}
        >
          <div className="rewind-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rewind-sheet-grabber" />
            <div className="date-wheels">
              <div className="wheel wheel-year" style={{ width: 96 }}>
                <input
                  className="year-input"
                  type="number"
                  inputMode="numeric"
                  value={picker.y}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPicker((p) => {
                      const y =
                        Number.isFinite(v) && v > 0 ? v : new Date().getFullYear();
                      const max = daysInMonth(y, p.m);
                      return { ...p, y, d: Math.min(p.d, max) };
                    });
                  }}
                  aria-label="年份"
                />
              </div>
              <Wheel
                value={picker.m}
                options={monthOptions}
                onChange={(m) =>
                  setPicker((p) => {
                    const max = daysInMonth(p.y, m);
                    return { ...p, m, d: Math.min(p.d, max) };
                  })
                }
                format={(o) => `${o}月`}
                width={84}
              />
              <Wheel
                value={picker.d}
                options={dayOptions}
                onChange={(d) => setPicker((p) => ({ ...p, d }))}
                format={(o) => `${o}日`}
                width={84}
              />
              <div className="wheel-indicator" />
            </div>
            <button
              className="rewind-sheet-confirm"
              disabled={!Number.isFinite(picker.y) || picker.y < 1}
              onClick={() => {
                const y = String(picker.y).padStart(4, "0");
                const m = String(picker.m).padStart(2, "0");
                const d = String(picker.d).padStart(2, "0");
                onUi?.("rewind", `${y}-${m}-${d}`);
                setShowRewind(false);
              }}
            >
              完成
            </button>
            <button
              className="rewind-sheet-cancel"
              onClick={() => setShowRewind(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
      {showClock && (
        <div
          className="rewind-sheet-backdrop"
          onClick={() => setShowClock(false)}
        >
          <div className="rewind-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rewind-sheet-grabber" />
            <div className="date-wheels">
              <Wheel
                value={clockPicker.h}
                options={HOUR_OPTIONS}
                onChange={(h) => setClockPicker((p) => ({ ...p, h }))}
                format={(v) => `${String(v).padStart(2, "0")}时`}
                width={110}
              />
              <Wheel
                value={clockPicker.m}
                options={MINUTE_OPTIONS}
                onChange={(m) => setClockPicker((p) => ({ ...p, m }))}
                format={(v) => `${String(v).padStart(2, "0")}分`}
                width={110}
              />
              <div className="wheel-indicator" />
            </div>
            <button
              className="rewind-sheet-confirm"
              onClick={() => {
                const hh = String(clockPicker.h).padStart(2, "0");
                const mm = String(clockPicker.m).padStart(2, "0");
                onUi?.("clock", `${hh}:${mm}`);
                setShowClock(false);
              }}
            >
              完成
            </button>
            {/* Hidden reset-clock entry; enabling Auto also calls resetClock. */}
            <button
              className="rewind-sheet-reset"
              style={{ display: "none" }}
              aria-label="reset-clock"
              onClick={() => {
                resetClock();
                setShowClock(false);
              }}
            />
            <button
              className="rewind-sheet-cancel"
              onClick={() => setShowClock(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
