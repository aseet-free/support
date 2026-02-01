"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import Nav from "./components/Nav";
import UpdateLine from "./components/UpdateLine";



type Workplace = "Gangnam" | "Yeouido" | "CityHall";

function toNumber(v: any): number {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  const cleaned = s.replace(/,/g, "").replace(/%/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function getCommuteMinutes(row: any, workplace: Workplace): number {
  const key =
    workplace === "Gangnam"
      ? "time_gangnam"
      : workplace === "Yeouido"
        ? "time_yeouido"
        : "time_cityhall";
  return toNumber(row[key]);
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return Math.round(n).toLocaleString("ko-KR");
}

function fmtMoneyManwon(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  return `${Math.round(n).toLocaleString("ko-KR")}만원`;
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "N/A";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

// ✅ 연식 색: 2000 이전 / 2000~2015 / 2015 이후
function yearBadge(yearBuilt: number) {
  if (!Number.isFinite(yearBuilt)) {
    return { text: "연식 N/A", cls: "border-gray-200 bg-gray-50 text-gray-700" };
  }
  if (yearBuilt < 2000) {
    return {
      text: `2000년 이전 (${yearBuilt})`,
      cls: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (yearBuilt <= 2015) {
    return {
      text: `2000~2015 (${yearBuilt})`,
      cls: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }
  return {
    text: `2015년 이후 (${yearBuilt})`,
    cls: "border-green-200 bg-green-50 text-green-700",
  };
}

// ✅ 세대수 색: <500 / 500~1500 / 1500+
function householdsBadge(households: number) {
  if (!Number.isFinite(households)) {
    return { text: "세대수 N/A", cls: "border-gray-200 bg-gray-50 text-gray-700" };
  }
  if (households < 500) {
    return {
      text: `소단지 (${fmtInt(households)}세대)`,
      cls: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  if (households < 1500) {
    return {
      text: `중단지 (${fmtInt(households)}세대)`,
      cls: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  return {
    text: `대단지 (${fmtInt(households)}세대)`,
    cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

// ✅ 평형 색: 20평대 / 30평대 / 기타
function pyeongBadge(pyeong: number) {
  if (!Number.isFinite(pyeong)) {
    return { text: "평형 N/A", cls: "border-gray-200 bg-gray-50 text-gray-700" };
  }
  if (pyeong >= 20 && pyeong < 30) {
    return {
      text: `20평대 (${fmtInt(pyeong)}평)`,
      cls: "border-cyan-200 bg-cyan-50 text-cyan-800",
    };
  }
  if (pyeong >= 30 && pyeong < 40) {
    return {
      text: `30평대 (${fmtInt(pyeong)}평)`,
      cls: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }
  return { text: `${fmtInt(pyeong)}평`, cls: "border-gray-200 bg-gray-50 text-gray-700" };
}

function buildReason(r: any, workplaceLabel: string) {
  const parts: string[] = [];

  // 1) 조건 충족(선택 직장 통근)
  if (Number.isFinite(r._commuteSelected)) {
    if (r._commuteSelected <= 30) parts.push(`${workplaceLabel}까지 통근이 매우 짧아요(${fmtInt(r._commuteSelected)}분)`);
    else if (r._commuteSelected <= 45) parts.push(`${workplaceLabel}까지 통근이 무난해요(${fmtInt(r._commuteSelected)}분)`);
    else parts.push(`${workplaceLabel}까지 통근 조건을 충족해요(${fmtInt(r._commuteSelected)}분)`);
  }

  // 2) 1순위: 강남 접근성
  // 선택 직장이 "강남"이면 이미 통근 문장에서 강남이 나오므로 중복 방지
  if (workplaceLabel !== "강남" && Number.isFinite(r._commuteGangnam)) {
    if (r._commuteGangnam <= 30) parts.push(`강남 접근성이 좋아요(${fmtInt(r._commuteGangnam)}분)`);
    else if (r._commuteGangnam <= 45) parts.push(`강남 접근성이 무난해요(${fmtInt(r._commuteGangnam)}분)`);
    else parts.push(`강남 접근성 기준으로도 비교가 돼요(${fmtInt(r._commuteGangnam)}분)`);
  }


  // 3) 2순위: 신축
  if (Number.isFinite(r._yearBuilt)) {
    if (r._yearBuilt >= 2015) parts.push(`2015년 이후 준공이라 신축급이에요`);
    else if (r._yearBuilt >= 2000) parts.push(`2000~2015 준공으로 관리 난이도가 무난한 편이에요`);
    else parts.push(`2000년 이전 준공이라 리모델링/수선비를 체크해요`);
  }

  // 4) 평형
  if (Number.isFinite(r._pyeong)) {
    if (r._pyeong >= 20 && r._pyeong < 30) parts.push(`20평대라 3인 가구 실거주에 많이 선택돼요`);
    else if (r._pyeong >= 30 && r._pyeong < 40) parts.push(`30평대라 실거주 만족도가 높은 편이에요`);
  }

  // 5) 세대수(커뮤니티/환금성 힌트)
  if (Number.isFinite(r._households)) {
    if (r._households >= 1500) parts.push(`대단지라 커뮤니티/환금성 측면에서 유리할 수 있어요`);
    else if (r._households >= 500) parts.push(`중단지라 수요층이 넓은 편이에요`);
    else parts.push(`소단지라 관리/거래 유동성은 체크해요`);
  }

  // 6) 가격(너무 길지 않게)
  if (Number.isFinite(r._price)) {
    parts.push(`현재 매매가는 ${fmtMoneyManwon(r._price)}이에요`);
  }

  // 문장 길이 제한: 2~3개만
  const picked = parts.slice(0, 3);
  return picked.join(" · ");
}


export default function Home() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>("");

  // ✅ 입력값
  const [budgetMin, setBudgetMin] = useState<number>(0);
  const [budgetMax, setBudgetMax] = useState<number>(0);
  const [workplace, setWorkplace] = useState<Workplace>("Gangnam");
  const [maxCommute, setMaxCommute] = useState<number>(60); // 선택 직장 기준 필터
  const [minYearBuilt, setMinYearBuilt] = useState<number>(0);

  // ✅ 결과
  const [candidates, setCandidates] = useState<any[]>([]);
  const [page, setPage] = useState<number>(0);
  const [message, setMessage] = useState<string>("");

  const workplaceLabel = useMemo(() => {
    if (workplace === "Gangnam") return "강남";
    if (workplace === "Yeouido") return "여의도";
    return "시청";
  }, [workplace]);

  // ✅ public/apartments.csv 자동 로드
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setLoadError("");

        const res = await fetch("/apartments.csv", { cache: "no-store" });
        if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);

        const text = await res.text();

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setRows(results.data as any[]);
            setLoading(false);
          },
          error: () => {
            setLoadError("CSV 파싱 중 오류가 발생했습니다.");
            setLoading(false);
          },
        });
      } catch (e: any) {
        setLoadError(e?.message ?? "CSV 로드 중 오류가 발생했습니다.");
        setLoading(false);
      }
    };

    load();
  }, []);

  const hasData = rows.length > 0;

  const handleFind = () => {
    setMessage("");
    setCandidates([]);
    setPage(0);

    if (!hasData) {
      setMessage("데이터를 불러오지 못했어요. (apartments.csv 확인)");
      return;
    }
    if (!budgetMax || budgetMax <= 0) {
      setMessage("예산 최대값을 입력해주세요. (예: 100000)");
      return;
    }
    if (budgetMin < 0) {
      setMessage("예산 최소값은 0 이상이어야 해요.");
      return;
    }
    if (budgetMin > budgetMax) {
      setMessage("예산 최소값이 최대값보다 클 수 없어요.");
      return;
    }
    if (!maxCommute || maxCommute <= 0) {
      setMessage("최대 통근 시간을 입력해주세요. (예: 60)");
      return;
    }

    const filtered = rows
      .map((r) => {
        const price = toNumber(r["current_price"]);

        // ✅ 필터용: 선택 직장 통근시간
        const commuteSelected = getCommuteMinutes(r, workplace);

        // ✅ 정렬 1순위: 강남 통근시간(항상)
        const commuteGangnam = toNumber(r["time_gangnam"]);

        const dropPct = toNumber(r["drop_from_peak_pct"]);
        const yearBuilt = toNumber(r["year_built"]);

        const pyeong = toNumber(r["pyeong"]);
        const households = toNumber(r["households"]);
        const rooms = toNumber(r["rooms"]);
        const bathrooms = toNumber(r["bathrooms"]);
        const schoolWalk = toNumber(r["school_walk_min"]);

        return {
          ...r,
          _price: price,
          _commuteSelected: commuteSelected,
          _commuteGangnam: commuteGangnam,
          _dropPct: dropPct,
          _yearBuilt: yearBuilt,
          _pyeong: pyeong,
          _households: households,
          _rooms: rooms,
          _bathrooms: bathrooms,
          _schoolWalk: schoolWalk,
        };
      })
      .filter((r) => {
        // 기본 숫자 유효성
        if (!Number.isFinite(r._price)) return false;

        // ✅ 선택 직장 통근시간 필터 (필수)
        if (!Number.isFinite(r._commuteSelected)) return false;
        if (r._commuteSelected > maxCommute) return false;

        // ✅ 예산 필터
        if (r._price < budgetMin) return false;
        if (r._price > budgetMax) return false;

        // ✅ 연식 필터(옵션)
        if (minYearBuilt && minYearBuilt > 0) {
          if (!Number.isFinite(r._yearBuilt)) return false;
          if (r._yearBuilt < minYearBuilt) return false;
        }

        return true;
      })
      // ✅ 정렬 우선순위:
      // 1) 강남 접근성(강남 통근 짧은 순)
      // 2) 신축(준공 최신)
      // 3) 가격 낮은 순
      .sort((a, b) => {
        const ag = Number.isFinite(a._commuteGangnam) ? a._commuteGangnam : Infinity;
        const bg = Number.isFinite(b._commuteGangnam) ? b._commuteGangnam : Infinity;
        if (ag !== bg) return ag - bg;

        const ay = Number.isFinite(a._yearBuilt) ? a._yearBuilt : -Infinity;
        const by = Number.isFinite(b._yearBuilt) ? b._yearBuilt : -Infinity;
        if (by !== ay) return by - ay;

        return a._price - b._price;
      });

    if (filtered.length === 0) {
      setMessage("조건에 맞는 아파트가 없어요. 조건을 완화해보세요.");
      return;
    }

    setCandidates(filtered);
  };

  const pageSize = 3;
  const totalPages = Math.ceil(candidates.length / pageSize);
  const start = page * pageSize;
  const currentTop3 = candidates.slice(start, start + pageSize);

  const handleNext = () => {
    if (candidates.length === 0) return;
    if (page + 1 >= totalPages) {
      setMessage("마지막 추천까지 다 봤어요. (처음으로 돌아갑니다)");
      setPage(0);
      return;
    }
    setMessage("");
    setPage((p) => p + 1);
  };

  const handlePrev = () => {
    if (candidates.length === 0) return;
    setMessage("");
    setPage((p) => Math.max(0, p - 1));
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-2">
          <Nav />
          <h1 className="text-2xl font-bold tracking-tight">서울 아파트 추천</h1>전고점·가격수준·접근성을 종합해 지금 검토할 만한 단지를 보여줍니다.
          <p className="text-sm text-gray-600">
            필터: <b>{workplaceLabel}</b> {maxCommute}분 이내 + 예산범위 (+연식옵션) · 정렬:{" "}
            <b>강남</b> → <b>신축</b> → <b>저렴</b>
          </p>
          <UpdateLine />
        </header>

        {loading && <div className="text-sm text-gray-500">데이터 불러오는 중...</div>}
        {loadError && (
          <div className="bg-white border rounded-2xl p-5 text-sm text-red-700">
            데이터 로드 실패: {loadError}
            <div className="text-xs text-gray-500 mt-1">
              확인: <b>web/public/apartments.csv</b>
            </div>
          </div>
        )}

        {/* 조건 입력 */}
        <section className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="font-semibold">조건 입력</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">예산 최소 (만원)</label>
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(Number(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="예: 70000"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">예산 최대 (만원)</label>
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="예: 100000"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">직장 위치</label>
              <select
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value as Workplace)}
                className="w-full border rounded-xl px-3 py-2"
              >
                <option value="Gangnam">강남</option>
                <option value="Yeouido">여의도</option>
                <option value="CityHall">시청</option>
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">{workplaceLabel}까지 최대 통근 (분)</label>
              <input
                type="number"
                value={maxCommute}
                onChange={(e) => setMaxCommute(Number(e.target.value))}
                className="w-full border rounded-xl px-3 py-2"
                placeholder="예: 60"
              />
            </div>

            <div className="sm:col-span-2">
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

          <button
            onClick={handleFind}
            disabled={loading || !!loadError}
            className="w-full bg-black text-white rounded-2xl py-3 font-semibold disabled:opacity-60"
          >
            추천 보기
          </button>
        </section>

        {message && (
          <section className="bg-white border rounded-2xl p-5 text-sm text-red-700">
            {message}
          </section>
        )}

        {currentTop3.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                추천 결과 (Top 3) — {page + 1}/{totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={page === 0}
                  className="px-3 py-2 text-sm rounded-xl border bg-white disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  onClick={handleNext}
                  className="px-3 py-2 text-sm rounded-xl border bg-white"
                >
                  Next
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {currentTop3.map((r, idx) => {
                const yb = yearBadge(r._yearBuilt);
                const hb = householdsBadge(r._households);
                const pb = pyeongBadge(r._pyeong);

                return (
                  <article
                    key={idx}
                    className="bg-white border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-lg font-bold truncate">
                          {r["complex_name"] ?? "단지명 없음"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {r["gu"] ?? ""} {r["dong"] ?? ""}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full border ${yb.cls}`}>
                            {yb.text}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${hb.cls}`}>
                            {hb.text}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${pb.cls}`}>
                            {pb.text}
                          </span>

                          {/* ✅ 표시: 선택 직장 + 강남 둘 다 */}
                          {Number.isFinite(r._commuteSelected) && (
                            <span className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                              {workplaceLabel} {fmtInt(r._commuteSelected)}분
                            </span>
                          )}
                          {Number.isFinite(r._commuteGangnam) && (
                            <span className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700">
                              강남 {fmtInt(r._commuteGangnam)}분
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-500">매매가</div>
                        <div className="text-xl font-bold">{fmtMoneyManwon(r._price)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div className="rounded-xl border bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">방</div>
                        <div className="font-semibold">
                          {Number.isFinite(r._rooms) ? `${fmtInt(r._rooms)}개` : "N/A"}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-gray-50 p-3">
                        <div className="text-xs text-gray-500">화장실</div>
                        <div className="font-semibold">
                          {Number.isFinite(r._bathrooms) ? `${fmtInt(r._bathrooms)}개` : "N/A"}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-gray-50 p-3 sm:col-span-2">
                        <div className="text-xs text-gray-500">초등학교</div>
                        <div className="font-semibold">
                          {r["school_name"] ?? "N/A"}
                          {Number.isFinite(r._schoolWalk) ? (
                            <span className="text-gray-500"> · 도보 {fmtInt(r._schoolWalk)}분</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-xs text-gray-500">
                      전고점 대비(참고):{" "}
                      <span className="font-medium text-gray-700">
                        {Number.isFinite(r._dropPct) ? fmtPct(r._dropPct) : "N/A"}
                      </span>
                    </div>
                    <div className="mt-3 rounded-xl border bg-gray-50 p-3 text-sm">
                      <div className="text-xs text-gray-500 mb-1">추천 이유</div>
                      <div className="font-medium text-gray-800">
                        {buildReason(r, workplaceLabel)}
                      </div>
                    </div>

                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
      <footer className="max-w-3xl mx-auto px-6 pb-8">
        <div className="text-xs text-gray-500">
          * 본 서비스는 매수·매도 조언이 아닌 판단 보조 자료입니다.
        </div>
      </footer>

    </main>
  );
}
