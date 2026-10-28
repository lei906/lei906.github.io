import { safeSourceUrl } from "./data.js?v=14";

let indexPromise;
export function validatedSources(records) {
  if (!Array.isArray(records)) throw new Error("Invalid content data");
  return records.filter(record => record && typeof record.title === "string" &&
    typeof record.summary === "string" && safeSourceUrl(record.url))
    .map(record => ({ title: record.title, summary: record.summary, url: safeSourceUrl(record.url) }));
}

export async function loadBranchSources(branchId) {
  if (!/^l\d+-t\d+-b\d+$/.test(branchId)) return [];
  if (!indexPromise) {
    indexPromise = fetch("./content-index.json", { cache: "no-cache" }).then(response => {
      if (!response.ok) throw new Error("Content index unavailable");
      return response.json();
    }).then(index => {
      if (!index || index.taxonomyVersion !== "2026-09-24" || !index.branches ||
          typeof index.branches !== "object" || Array.isArray(index.branches))
        throw new Error("Content taxonomy mismatch");
      return index;
    }).catch(error => { indexPromise = undefined; throw error; });
  }
  const index = await indexPromise;
  if (!Object.hasOwn(index.branches, branchId)) return [];
  const response = await fetch(`./content/${branchId}.json`);
  if (!response.ok) throw new Error("Branch content unavailable");
  const data = await response.json();
  if (data.branchId !== branchId || data.taxonomyVersion !== index.taxonomyVersion)
    throw new Error("Branch content mismatch");
  return validatedSources(data.sources);
}
