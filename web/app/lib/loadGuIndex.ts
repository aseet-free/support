import Papa from "papaparse";

export type GuIndexRow = {
    ym: string; // "YYYY-MM"
    [key: string]: string | number; // 구 컬럼들(숫자)
};

function toNumber(v: unknown): number {
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim();
    if (!s) return NaN;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
}

export async function loadGuIndexFromPublic(): Promise<GuIndexRow[]> {
    const res = await fetch("/gu_index.csv", { cache: "no-store" });
    if (!res.ok) throw new Error(`gu_index.csv fetch failed: ${res.status}`);

    const text = await res.text();

    return await new Promise((resolve, reject) => {
        Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = (results.data ?? [])
                    .map((r) => {
                        const ym = String(r["ym"] ?? "").trim();
                        if (!ym) return null;

                        const out: GuIndexRow = { ym };
                        Object.keys(r).forEach((k) => {
                            if (k === "ym") return;
                            const val = toNumber(r[k]);
                            if (Number.isFinite(val)) out[k] = val;
                        });
                        return out;
                    })
                    .filter(Boolean) as GuIndexRow[];

                resolve(rows);
            },
            error: (err: unknown) => reject(err),
        });
    });
}
