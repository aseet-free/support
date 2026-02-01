"use client";
<div style={{ color: "red" }}>INDEX PAGE</div>
import { useEffect, useMemo, useState } from "react";
import Nav from "../components/Nav";
import Papa from "papaparse";
import UpdateLine from "../components/UpdateLine";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
    ReferenceLine,
} from "recharts";

type Row = Record<string, any>;

/** ====== 유틸 ====== **/

function parseYm(v: string): string {
    // "2008년 1월" -> "2008-01"
    const s = String(v ?? "").trim();
    const m = s.match(/(\d{4})\s*년\s*(\d{1,2})\s*월/);
    if (!m) return s;
    const yyyy = m[1];
    const mm = String(Number(m[2])).padStart(2, "0");
    return `${yyyy}-${mm}`;
}

function withinRange(ym: string, start: string, end: string) {
    return ym >= start && ym <= end;
}

function toNum(v: any): number | null {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const cleaned = s.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function fmt1(n: number | null) {
    if (n === null || !Number.isFinite(n)) return "—";
    return n.toFixed(1);
}

function fmtDelta(n: number | null) {
    if (n === null || !Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}`;
}

function fmtPct(n: number | null) {
    if (n === null || !Number.isFinite(n)) return "—";
    const sign = n > 0 ? "+" : "";
    return `${sign}${n.toFixed(1)}%`;
}

/** ====== 색상: HSL로 구마다 확실히 다르게 ====== **/
function colorForGu(gu: string) {
    let hash = 0;
    for (let i = 0; i < gu.length; i++) hash = (hash * 31 + gu.charCodeAt(i)) % 360;
    return `hsl(${hash}, 70%, 45%)`;
}

export default function IndexPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [months, setMonths] = useState<string[]>([]);
    const [gus, setGus] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    const [startYm, setStartYm] = useState("");
    const [endYm, setEndYm] = useState("");

    const [selectedGus, setSelectedGus] = useState<string[]>([]);
    const [step, setStep] = useState<1 | 3 | 6>(1);

    // ✅ 기준 컬럼명(서울특별시)
    const SEOUL_KEY = "서울특별시";

    /** CSV 로드 */
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setErr("");

                const res = await fetch("/gu_index.csv", { cache: "no-store" });
                if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
                const text = await res.text();

                const data: Row[] = await new Promise((resolve, reject) => {
                    Papa.parse(text, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (r) => resolve(r.data as Row[]),
                        error: (e: unknown) => reject(e),

                    });
                });

                if (!data.length) throw new Error("CSV에 데이터가 없습니다.");

                const keys = Object.keys(data[0]);
                const ymKey =
                    keys.find((k) => k === "ym") ||
                    keys.find((k) => k.toLowerCase().includes("unnamed")) ||
                    keys.find((k) => k.includes("월")) ||
                    keys[0];

                const normalized = data
                    .map((r) => ({ ...r, ym: parseYm(r[ymKey]) }))
                    .filter((r) => r.ym && /^\d{4}-\d{2}$/.test(r.ym))
                    .sort((a, b) => String(a.ym).localeCompare(String(b.ym)));

                if (!normalized.length) {
                    throw new Error("월(YYYY-MM) 파싱에 실패했습니다. 월 컬럼 형식을 확인해줘.");
                }

                if (!keys.includes(SEOUL_KEY)) {
                    throw new Error(`CSV에 "${SEOUL_KEY}" 컬럼이 없습니다. (원지수 기준 편차 계산에 필요)`);
                }

                // 선택 가능한 구 = 전국/서울특별시 제외
                const guKeys = keys
                    .filter((k) => k !== ymKey && k !== "ym")
                    .filter((k) => k !== "전국" && k !== SEOUL_KEY);

                const ms = normalized.map((r) => r.ym);
                setRows(normalized);
                setMonths(ms);
                setStartYm(ms[0]);
                setEndYm(ms[ms.length - 1]);
                setGus(guKeys);

                const defaultPick = ["강남구", "서초구", "송파구", "마포구", "용산구"].filter((g) =>
                    guKeys.includes(g)
                );
                setSelectedGus(defaultPick.length ? defaultPick : guKeys.slice(0, 8));
            } catch (e: any) {
                setErr(e?.message ?? "로드 실패");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    /** start/end 뒤집힘 방지 */
    useEffect(() => {
        if (startYm && endYm && startYm > endYm) setEndYm(startYm);
    }, [startYm, endYm]);

    /** 구 토글 */
    const toggleGu = (gu: string) => {
        setSelectedGus((prev) => {
            const next = prev.includes(gu) ? prev.filter((g) => g !== gu) : [...prev, gu];
            return next;
        });
    };

    /**
     * chartData: 편차(구 - 서울특별시)
     * rawDataForTable: 표 검증/계산용 원지수도 함께 가지고 간다.
     */
    const { chartData, rawTable } = useMemo(() => {
        if (!rows.length || !startYm || !endYm || selectedGus.length === 0) {
            return { chartData: [] as any[], rawTable: [] as any[] };
        }

        const sliced = rows
            .filter((r) => withinRange(r.ym, startYm, endYm))
            .filter((_, idx) => idx % step === 0);

        const chart = sliced.map((r) => {
            const seoul = toNum(r[SEOUL_KEY]);
            const obj: any = { ym: r.ym };

            selectedGus.forEach((gu) => {
                const v = toNum(r[gu]);
                // ✅ 원지수 편차: (구 지수 - 서울 지수)
                obj[gu] = v === null || seoul === null ? null : v - seoul;
            });

            return obj;
        });

        // 표 검증용: 원지수도 함께
        const raw = sliced.map((r) => {
            const seoul = toNum(r[SEOUL_KEY]);
            const obj: any = { ym: r.ym, _seoul: seoul };
            selectedGus.forEach((gu) => {
                obj[gu] = toNum(r[gu]); // 원지수
            });
            return obj;
        });

        return { chartData: chart, rawTable: raw };
    }, [rows, startYm, endYm, selectedGus, step]);

    /**
     * summary:
     * - 편차(start/end/min/max): chartData 기준 (구-서울)
     * - 변화율(%): 원지수(rawTable) 기준으로 계산 (의미 있는 %)
     */
    const summary = useMemo(() => {
        if (!chartData.length || !rawTable.length || selectedGus.length === 0) return [];

        const firstDiff = chartData[0];
        const lastDiff = chartData[chartData.length - 1];

        const firstRaw = rawTable[0];
        const lastRaw = rawTable[rawTable.length - 1];

        return selectedGus
            .map((gu) => {
                // 편차 시리즈(구-서울)
                const diffSeries = chartData
                    .map((r: any) => (typeof r[gu] === "number" ? (r[gu] as number) : null))
                    .filter((v): v is number => v !== null);

                const diffStart = typeof firstDiff[gu] === "number" ? (firstDiff[gu] as number) : null;
                const diffEnd = typeof lastDiff[gu] === "number" ? (lastDiff[gu] as number) : null;
                const diffMin = diffSeries.length ? Math.min(...diffSeries) : null;
                const diffMax = diffSeries.length ? Math.max(...diffSeries) : null;
                const diffDelta = diffStart !== null && diffEnd !== null ? diffEnd - diffStart : null;

                // 원지수(구) 시작/끝
                const rawStart = typeof firstRaw[gu] === "number" ? (firstRaw[gu] as number) : null;
                const rawEnd = typeof lastRaw[gu] === "number" ? (lastRaw[gu] as number) : null;

                // ✅ 변화율은 원지수 기준
                const rawPct =
                    rawStart !== null && rawEnd !== null && rawStart !== 0
                        ? ((rawEnd / rawStart) - 1) * 100
                        : null;

                // 표 검증용(원지수 변화를 같이 보여주면 신뢰도↑)
                const rawDelta = rawStart !== null && rawEnd !== null ? rawEnd - rawStart : null;

                return {
                    gu,
                    // 편차(차트와 동일)
                    diffStart,
                    diffEnd,
                    diffDelta,
                    diffMin,
                    diffMax,
                    // 원지수(검증/해석)
                    rawStart,
                    rawEnd,
                    rawDelta,
                    rawPct,
                };
            })
            // 정렬: 최근 편차(diffEnd)가 높은 순
            .sort((a, b) => (b.diffEnd ?? -Infinity) - (a.diffEnd ?? -Infinity));
    }, [chartData, rawTable, selectedGus]);

    const canDraw = !loading && !err && selectedGus.length > 0;

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto p-6 space-y-6">
                <header className="space-y-2">
                    <Nav /><div className="text-sm text-gray-600">
                        서울 평균을 기준으로 각 구의 상대적인 가격 흐름을 비교합니다.
                        <br />
                        0을 기준으로 위에 있을수록 서울 평균보다 비싸고,
                        아래에 있을수록 상대적으로 저렴합니다.
                    </div>
                    <UpdateLine />

                    <h1 className="text-2xl font-bold tracking-tight">구별 지수 추이 비교</h1>
                    <p className="text-sm text-gray-600">
                        ✅ 차트/표의 편차는 <b>(구 지수 - 서울특별시 지수)</b> 입니다. (원지수 기준)
                    </p>
                </header>

                {loading && <div className="text-sm text-gray-500">불러오는 중...</div>}
                {err && (
                    <div className="bg-white border rounded-2xl p-5 text-sm text-red-700">
                        데이터 로드 실패: {err}
                        <div className="text-xs text-gray-500 mt-2">
                            확인: <b>web/public/gu_index.csv</b> (서울특별시 컬럼 필수)
                        </div>
                    </div>
                )}

                {!loading && !err && (
                    <>
                        {/* 기간/간격 */}
                        <section className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="font-semibold">기간 선택</div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm mb-1">시작</label>
                                    <select
                                        value={startYm}
                                        onChange={(e) => setStartYm(e.target.value)}
                                        className="w-full border rounded-xl px-3 py-2"
                                    >
                                        {months.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">끝</label>
                                    <select
                                        value={endYm}
                                        onChange={(e) => setEndYm(e.target.value)}
                                        className="w-full border rounded-xl px-3 py-2"
                                    >
                                        {months.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="block text-sm mb-1">표시 간격(조밀함 완화)</label>
                                <select
                                    value={String(step)}
                                    onChange={(e) => setStep(Number(e.target.value) as 1 | 3 | 6)}
                                    className="w-full sm:w-64 border rounded-xl px-3 py-2"
                                >
                                    <option value="1">월간(모든 월)</option>
                                    <option value="3">분기(3개월)</option>
                                    <option value="6">반기(6개월)</option>
                                </select>
                            </div>
                        </section>

                        {/* 구 선택 */}
                        <section className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="font-semibold">
                                비교할 구 선택{" "}
                                <span className="text-sm text-gray-500">(선택한 것만 표시)</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {gus.map((gu) => {
                                    const active = selectedGus.includes(gu);
                                    return (
                                        <button
                                            key={gu}
                                            onClick={() => toggleGu(gu)}
                                            className={[
                                                "px-3 py-1 rounded-full border text-sm",
                                                active ? "bg-black text-white border-black" : "bg-white text-gray-700",
                                            ].join(" ")}
                                        >
                                            {gu}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedGus.length === 0 && (
                                <div className="text-sm text-red-700">최소 1개 구는 선택해야 그래프가 표시돼요.</div>
                            )}
                        </section>

                        {/* 차트 */}
                        <section className="bg-white border rounded-2xl p-5 shadow-sm">
                            <div className="font-semibold mb-2">선 그래프 (서울 대비 편차)</div>

                            <div className="h-[420px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.4} />
                                        <XAxis dataKey="ym" minTickGap={20} />
                                        <YAxis domain={["auto", "auto"]} padding={{ top: 30, bottom: 30 }} />
                                        <Tooltip />
                                        <Legend />
                                        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="6 6" />

                                        {/* ✅ 흐리게 하지 않음: 모두 동일 opacity */}
                                        {selectedGus.map((gu) => (
                                            <Line
                                                key={gu}
                                                type="monotone"
                                                dataKey={gu}
                                                dot={false}
                                                connectNulls
                                                stroke={colorForGu(gu)}
                                                strokeWidth={2}
                                                strokeOpacity={0.9}
                                                isAnimationActive={false}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="text-xs text-gray-500 mt-2">
                                * 값 해석: +10이면 <b>해당 구 지수가 서울 지수보다 10 높다</b>, -10이면 10 낮다.
                            </div>
                        </section>

                        {/* 표(검증 포함) */}
                        <section className="bg-white border rounded-2xl p-5 shadow-sm overflow-x-auto">
                            <div className="font-semibold mb-3">요약 표</div>

                            {!canDraw ? (
                                <div className="text-sm text-gray-500">선택/기간을 설정하면 표가 표시됩니다.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="py-2">구</th>
                                            <th className="py-2">편차 시작</th>
                                            <th className="py-2">편차 끝</th>
                                            <th className="py-2">편차 변화</th>
                                            <th className="py-2">편차 최저~최고</th>
                                            <th className="py-2">원지수 시작</th>
                                            <th className="py-2">원지수 끝</th>
                                            <th className="py-2">원지수 변화</th>
                                            <th className="py-2">원지수 변화율</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.map((r) => (
                                            <tr key={r.gu} className="border-b last:border-0">
                                                <td className="py-2 font-medium whitespace-nowrap">
                                                    <span
                                                        className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle"
                                                        style={{ background: colorForGu(r.gu) }}
                                                    />
                                                    {r.gu}
                                                </td>

                                                {/* 편차(구-서울) */}
                                                <td className="py-2">{fmt1(r.diffStart)}</td>
                                                <td className="py-2 font-semibold">{fmt1(r.diffEnd)}</td>
                                                <td className="py-2">{fmtDelta(r.diffDelta)}</td>
                                                <td className="py-2 text-gray-600">
                                                    {r.diffMin === null || r.diffMax === null
                                                        ? "—"
                                                        : `${r.diffMin.toFixed(1)} ~ ${r.diffMax.toFixed(1)}`}
                                                </td>

                                                {/* 원지수(구) */}
                                                <td className="py-2">{fmt1(r.rawStart)}</td>
                                                <td className="py-2 font-semibold">{fmt1(r.rawEnd)}</td>
                                                <td className="py-2">{fmtDelta(r.rawDelta)}</td>
                                                <td className="py-2">{fmtPct(r.rawPct)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            <div className="text-xs text-gray-500 mt-2">
                                * “변화율”은 <b>원지수(구 지수)</b> 기준으로 계산했습니다. (편차는 0/음수 가능해서 %가 왜곡될 수 있음)
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
