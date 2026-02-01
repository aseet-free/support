"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "../components/Nav";
import UpdateLine from "../components/UpdateLine";
import { loadApartmentsFromPublic, toNumber } from "../lib/loadApartments";

function fmtInt(n: number): string {
    if (!Number.isFinite(n)) return "N/A";
    return Math.round(n).toLocaleString("ko-KR");
}
function fmtMoneyManwon(n: number): string {
    if (!Number.isFinite(n)) return "N/A";
    return `${Math.round(n).toLocaleString("ko-KR")}만원`;
}
function fmtPyeong(n: number): string {
    if (!Number.isFinite(n)) return "N/A";
    return `${Math.round(n)}평`;
}
function fmtHouseholds(n: number): string {
    if (!Number.isFinite(n)) return "N/A";
    return `${Math.round(n).toLocaleString("ko-KR")}세대`;
}
function fmtYear(n: number): string {
    if (!Number.isFinite(n)) return "N/A";
    return `${Math.round(n)}년`;
}

// 전고점 대비 % 재계산
function pctFromPeak(current: number, peak: number): number {
    if (!Number.isFinite(current) || !Number.isFinite(peak) || peak === 0) return NaN;
    return Math.round(((current / peak) - 1) * 100);
}

// ✅ 해석 문장 (파일 최상단에 있어야 JSX에서 접근 가능)
function interpretPriceLevel(pct: number): string {
    if (!Number.isFinite(pct)) return "전고점 대비 수준을 판단할 수 없습니다.";

    if (pct <= 0) return "전고점 대비 조정 구간(0% 이하)으로 적극 관심 구간입니다.";
    if (pct <= 15) return "전고점 회복 초기(0~15%)로 관심 구간입니다.";
    if (pct <= 25) return "전고점 근접(15~25%)으로 주의 구간입니다.";
    return "전고점 대비 높은 수준(25% 이상)으로 고점 구간입니다.";
}

// ✅ 배지(네 기준 반영)
function pctBadge(pct: number) {
    if (!Number.isFinite(pct)) {
        return { text: "N/A", cls: "bg-gray-50 border-gray-200 text-gray-700", level: "N/A" };
    }
    if (pct <= 0) {
        return { text: `${pct}%`, cls: "bg-emerald-50 border-emerald-200 text-emerald-700", level: "적극 관심" };
    }
    if (pct <= 15) {
        return { text: `+${pct}%`, cls: "bg-cyan-50 border-cyan-200 text-cyan-800", level: "관심" };
    }
    if (pct <= 25) {
        return { text: `+${pct}%`, cls: "bg-amber-50 border-amber-200 text-amber-800", level: "주의" };
    }
    return { text: `+${pct}%`, cls: "bg-rose-50 border-rose-200 text-rose-700", level: "고점 구간" };
}

function ageLabel(yearBuilt: number) {
    if (!Number.isFinite(yearBuilt)) return { text: "연식 N/A", cls: "bg-gray-50 border-gray-200 text-gray-700" };
    if (yearBuilt >= 2015) return { text: `신축급(${Math.round(yearBuilt)})`, cls: "bg-green-50 border-green-200 text-green-700" };
    if (yearBuilt >= 2000) return { text: `중축(${Math.round(yearBuilt)})`, cls: "bg-blue-50 border-blue-200 text-blue-700" };
    return { text: `노후(${Math.round(yearBuilt)})`, cls: "bg-amber-50 border-amber-200 text-amber-800" };
}
function sizeLabel(households: number) {
    if (!Number.isFinite(households)) return { text: "세대수 N/A", cls: "bg-gray-50 border-gray-200 text-gray-700" };
    if (households >= 1500) return { text: `대단지(${fmtInt(households)})`, cls: "bg-emerald-50 border-emerald-200 text-emerald-700" };
    if (households >= 500) return { text: `중단지(${fmtInt(households)})`, cls: "bg-indigo-50 border-indigo-200 text-indigo-700" };
    return { text: `소단지(${fmtInt(households)})`, cls: "bg-rose-50 border-rose-200 text-rose-700" };
}
function pyeongLabel(pyeong: number) {
    if (!Number.isFinite(pyeong)) return { text: "평형 N/A", cls: "bg-gray-50 border-gray-200 text-gray-700" };
    if (pyeong >= 20 && pyeong < 30) return { text: `20평대(${Math.round(pyeong)}평)`, cls: "bg-cyan-50 border-cyan-200 text-cyan-800" };
    if (pyeong >= 30 && pyeong < 40) return { text: `30평대(${Math.round(pyeong)}평)`, cls: "bg-violet-50 border-violet-200 text-violet-700" };
    return { text: `${Math.round(pyeong)}평`, cls: "bg-gray-50 border-gray-200 text-gray-700" };
}

export default function PriceLevelPage() {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    // 필터
    const [gu, setGu] = useState<string>("");
    const [sort, setSort] = useState<"most_drop" | "closest_peak">("most_drop");
    const [minHouseholds, setMinHouseholds] = useState<number>(0);
    const [minYearBuilt, setMinYearBuilt] = useState<number>(0);

    // 페이지네이션
    const [page, setPage] = useState<number>(0);
    const pageSize = 3;

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setErr("");
                const data = await loadApartmentsFromPublic();
                setRows(data);
            } catch (e: any) {
                setErr(e?.message ?? "로드 실패");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const guOptions = useMemo(() => {
        const s = new Set<string>();
        rows.forEach((r) => {
            const g = String(r["gu"] ?? "").trim();
            if (g) s.add(g);
        });
        return Array.from(s).sort((a, b) => a.localeCompare(b, "ko"));
    }, [rows]);

    const items = useMemo(() => {
        const mapped = rows
            .map((r) => {
                const current = toNumber(r["current_price"]);
                const peak = toNumber(r["peak_price"]);
                const pct = pctFromPeak(current, peak);

                const yearBuilt = toNumber(r["year_built"]);
                const households = toNumber(r["households"]);
                const pyeong = toNumber(r["pyeong"]);

                return {
                    ...r,
                    _current: current,
                    _peak: peak,
                    _pct: pct,
                    _yearBuilt: yearBuilt,
                    _households: households,
                    _pyeong: pyeong,
                };
            })
            .filter((r) => Number.isFinite(r._current) && Number.isFinite(r._peak));

        const filteredByGu = gu ? mapped.filter((r) => String(r["gu"] ?? "") === gu) : mapped;

        const filtered = filteredByGu.filter((r) => {
            if (minHouseholds > 0) {
                if (!Number.isFinite(r._households)) return false;
                if (r._households < minHouseholds) return false;
            }
            if (minYearBuilt > 0) {
                if (!Number.isFinite(r._yearBuilt)) return false;
                if (r._yearBuilt < minYearBuilt) return false;
            }
            return true;
        });

        filtered.sort((a, b) => {
            if (sort === "most_drop") return a._pct - b._pct;
            return b._pct - a._pct;
        });

        return filtered;
    }, [rows, gu, sort, minHouseholds, minYearBuilt]);

    useEffect(() => {
        setPage(0);
    }, [gu, sort, minHouseholds, minYearBuilt]);

    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const start = page * pageSize;
    const currentPageItems = items.slice(start, start + pageSize);

    const handleNext = () => {
        if (items.length === 0) return;
        if (page + 1 >= totalPages) setPage(0);
        else setPage((p) => p + 1);
    };
    const handlePrev = () => setPage((p) => Math.max(0, p - 1));

    return (
        <main className="min-h-screen bg-gray-50">
            <div className="max-w-3xl mx-auto p-6 space-y-6">
                <header className="space-y-2">
                    <Nav />
                    <h1 className="text-2xl font-bold tracking-tight">가격 수준 파악</h1>
                    <p className="text-sm text-gray-600">전고점 대비 현재가(%)를 한눈에 봅니다.</p>

                    <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
                        <div className="font-semibold mb-2">전고점 대비 판단 기준</div>
                        <ul className="space-y-1">
                            <li>• 0% 이하 : 적극 관심</li>
                            <li>• 0% ~ 15% : 관심</li>
                            <li>• 15% ~ 25% : 주의</li>
                            <li>• 25% 이상 : 고점 구간</li>
                        </ul>
                    </div>

                    <UpdateLine />
                </header>

                {loading && <div className="text-sm text-gray-500">불러오는 중...</div>}
                {err && <div className="bg-white border rounded-2xl p-5 text-sm text-red-700">데이터 로드 실패: {err}</div>}

                {!loading && !err && (
                    <>
                        <section className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="font-semibold">필터</div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm mb-1">구</label>
                                    <select value={gu} onChange={(e) => setGu(e.target.value)} className="w-full border rounded-xl px-3 py-2">
                                        <option value="">전체</option>
                                        {guOptions.map((g) => (
                                            <option key={g} value={g}>
                                                {g}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">정렬</label>
                                    <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-full border rounded-xl px-3 py-2">
                                        <option value="most_drop">전고점 대비 하락 큰 순</option>
                                        <option value="closest_peak">전고점에 가까운 순</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">최소 세대수 (0이면 미사용)</label>
                                    <input
                                        type="number"
                                        value={minHouseholds}
                                        onChange={(e) => setMinHouseholds(Number(e.target.value))}
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="예: 500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">최소 준공년도 (0이면 미사용)</label>
                                    <input
                                        type="number"
                                        value={minYearBuilt}
                                        onChange={(e) => setMinYearBuilt(Number(e.target.value))}
                                        className="w-full border rounded-xl px-3 py-2"
                                        placeholder="예: 2000"
                                    />
                                </div>
                            </div>
                        </section>

                        <section className="flex items-center justify-between">
                            <div className="font-semibold">
                                결과 — {items.length ? page + 1 : 0}/{items.length ? totalPages : 0}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handlePrev}
                                    disabled={page === 0 || items.length === 0}
                                    className="px-3 py-2 text-sm rounded-xl border bg-white disabled:opacity-50"
                                >
                                    Prev
                                </button>
                                <button onClick={handleNext} disabled={items.length === 0} className="px-3 py-2 text-sm rounded-xl border bg-white disabled:opacity-50">
                                    Next
                                </button>
                            </div>
                        </section>

                        {items.length === 0 ? (
                            <section className="bg-white border rounded-2xl p-5 text-sm text-gray-600">
                                조건에 맞는 단지가 없습니다. 필터를 완화해보세요.
                            </section>
                        ) : (
                            <section className="space-y-3">
                                {currentPageItems.map((r, idx) => {
                                    const b = pctBadge(r._pct);
                                    const y = ageLabel(r._yearBuilt);
                                    const h = sizeLabel(r._households);
                                    const p = pyeongLabel(r._pyeong);

                                    return (
                                        <article key={`${page}-${idx}`} className="bg-white border rounded-2xl p-5 shadow-sm">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="text-lg font-bold truncate">{r["complex_name"] ?? "단지명 없음"}</div>
                                                    <div className="text-sm text-gray-600">
                                                        {r["gu"] ?? ""} {r["dong"] ?? ""}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <span className={`text-xs px-2 py-1 rounded-full border ${p.cls}`}>{p.text}</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full border ${h.cls}`}>{h.text}</span>
                                                        <span className={`text-xs px-2 py-1 rounded-full border ${y.cls}`}>{y.text}</span>
                                                    </div>
                                                </div>

                                                <div className={`px-3 py-2 rounded-xl border text-sm font-semibold ${b.cls}`}>
                                                    {b.level} · {b.text}
                                                </div>
                                            </div>

                                            <div className="mt-3 text-xs text-gray-600 bg-gray-50 border rounded-xl p-3">
                                                {interpretPriceLevel(r._pct)}
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                <div className="rounded-xl border bg-gray-50 p-3">
                                                    <div className="text-xs text-gray-500">현재가</div>
                                                    <div className="font-semibold">{fmtMoneyManwon(r._current)}</div>
                                                </div>
                                                <div className="rounded-xl border bg-gray-50 p-3">
                                                    <div className="text-xs text-gray-500">전고점</div>
                                                    <div className="font-semibold">{fmtMoneyManwon(r._peak)}</div>
                                                </div>
                                            </div>

                                            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
                                                <div className="rounded-xl border bg-white p-2">
                                                    <div className="text-gray-500">평형</div>
                                                    <div className="font-medium">{fmtPyeong(r._pyeong)}</div>
                                                </div>
                                                <div className="rounded-xl border bg-white p-2">
                                                    <div className="text-gray-500">세대수</div>
                                                    <div className="font-medium">{fmtHouseholds(r._households)}</div>
                                                </div>
                                                <div className="rounded-xl border bg-white p-2">
                                                    <div className="text-gray-500">준공</div>
                                                    <div className="font-medium">{fmtYear(r._yearBuilt)}</div>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
