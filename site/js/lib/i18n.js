// The site in two languages. Turkish pages live in site/, their English twins in site/en/ with the same file names;
// <html lang="…"> tells the shared scripts which language to speak. Node (the tests) gets Turkish.
//   t("Çalıştır", "Run")          a string in the page's language
//   tx(ex, "hint")                ex.hint_en on English pages when it exists, else ex.hint
export const LANG = typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "tr";
export const EN = LANG === "en";
export const t = (tr, en) => (EN ? en : tr);
export const tx = (obj, key) => (EN && obj?.[`${key}_en`] != null ? obj[`${key}_en`] : obj?.[key]);
/** Number words used in UI counts: "3 satır" / "3 rows". */
export const rowsText = (n) => (EN ? `${n} row${n === 1 ? "" : "s"}` : `${n} satır`);
