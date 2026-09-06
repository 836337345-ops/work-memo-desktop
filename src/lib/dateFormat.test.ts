import { describe, expect, it } from "vitest";
import { formatChineseDate, formatChineseDateTime } from "./dateFormat";

describe("dateFormat", () => {
  it("将日期统一显示为中文年月日", () => {
    expect(formatChineseDate("2026-09-06")).toBe("2026年9月6日");
    expect(formatChineseDate(null)).toBe("未设日期");
  });

  it("时间戳保留到分钟", () => {
    const value = new Date(2026, 8, 6, 14, 5).toISOString();
    expect(formatChineseDateTime(value)).toBe("2026年9月6日 14:05");
  });

  it("无法识别的值保持原样", () => {
    expect(formatChineseDate("待确认")).toBe("待确认");
    expect(formatChineseDateTime("待确认")).toBe("待确认");
  });
});
