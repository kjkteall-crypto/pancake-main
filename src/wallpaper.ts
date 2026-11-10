import type { CSSProperties } from "react";

// 内置图片壁纸：文件放在 public/wallpapers/ 下，会随构建产物一起发布，不依赖网络
export const BUILTIN_PHOTOS: { id: string; name: string }[] = [
  { id: "photo-1", name: "晨光" },
  { id: "photo-2", name: "深海" },
  { id: "photo-3", name: "暮色" },
];

// CSS 渐变 / 纯色预设
export const CSS_WALLPAPERS: { id: string; name: string }[] = [
  { id: "sage", name: "灰绿" },
  { id: "sand", name: "米沙" },
  { id: "night", name: "夜色" },
  { id: "rose", name: "玫瑰" },
  { id: "silver", name: "银灰" },
];

// 玩家上传图片存的值：upload: + 压缩后的 data URL
export const UPLOAD_PREFIX = "upload:";

export function isBuiltinPhoto(id: string): boolean {
  return BUILTIN_PHOTOS.some((p) => p.id === id);
}

export function isUpload(id: string): boolean {
  return id.startsWith(UPLOAD_PREFIX);
}

export function isImageWallpaper(id: string): boolean {
  return isBuiltinPhoto(id) || isUpload(id);
}

// 图片壁纸返回可直接用的 background-image 样式，其余（CSS 渐变）返回 undefined
export function wallpaperImage(id: string): CSSProperties | undefined {
  if (isBuiltinPhoto(id)) {
    // 构建配置 base: "./"，相对路径同时适配本地预览与 GitHub Pages 子路径
    return { backgroundImage: `url("./wallpapers/${id}.jpg")` };
  }
  if (isUpload(id)) {
    return { backgroundImage: `url("${id.slice(UPLOAD_PREFIX.length)}")` };
  }
  return undefined;
}

// 用于 className：图片壁纸统一归到 wallpaper-image，其余按 id 走 CSS 类
export function wallpaperClass(id: string): string {
  return isImageWallpaper(id) ? "wallpaper-image" : `wallpaper-${id}`;
}
