import { load } from "cheerio";

export function plainText(value) {
  if (typeof value !== "string") return "";
  const $ = load(value);
  $("script, style").remove();
  $("br").replaceWith(" ");
  $("p, div, li").append(" ");
  return $.root().text();
}

export function findBlockedKeyword(workOrder, keywords = []) {
  for (const field of ["title", "description"]) {
    const text = plainText(workOrder[field]);
    for (const value of keywords) {
      if (typeof value !== "string" || !value.trim()) continue;
      const keyword = value.trim();
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
      if (pattern.test(text)) return { keyword, field };
    }
  }
  return null;
}
