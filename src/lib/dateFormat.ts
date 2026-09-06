const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatChineseDate(
  value: string | null | undefined,
  emptyText = "未设日期",
): string {
  if (!value) {
    return emptyText;
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return value;
  }

  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

export function formatChineseDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}
