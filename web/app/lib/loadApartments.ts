import Papa from "papaparse";

export async function loadApartmentsFromPublic(): Promise<any[]> {
    const res = await fetch("/apartments.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

    const text = await res.text();

    return await new Promise((resolve, reject) => {
        Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as any[]),
            error: (err: unknown) => reject(err),
        });

    });
}

export function toNumber(v: any): number {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim();
    if (!s) return NaN;
    const cleaned = s.replace(/,/g, "").replace(/%/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
}
