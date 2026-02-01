"use client";

import Papa from "papaparse";
import type { ParseResult } from "papaparse";

type Props = {
    onDataLoaded: (rows: any[]) => void;
};

function stripUtf8Bom(text: string) {
    // UTF-8 BOM 제거
    return text.replace(/^\uFEFF/, "");
}

export default function CsvUpload({ onDataLoaded }: Props) {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            const text = stripUtf8Bom(String(reader.result ?? ""));

            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                // ✅ 문자열을 직접 parse 하니까 인코딩 문제를 우회할 수 있음
                complete: (results: ParseResult<any>) => {
                    onDataLoaded(results.data as any[]);
                },
                error: (err) => {
                    console.error("CSV parse error:", err);
                    alert("CSV 파일을 읽는 중 오류가 발생했습니다.");
                },
            });
        };

        reader.onerror = () => {
            alert("파일을 읽는 중 오류가 발생했습니다.");
        };

        // ✅ 여기서 텍스트로 읽을 때 브라우저는 UTF-8로 읽음 (BOM도 처리)
        reader.readAsText(file, "utf-8");
    };

    return (
        <div className="border rounded p-4">
            <div className="font-semibold mb-2">1) CSV 파일 업로드</div>
            <input type="file" accept=".csv" onChange={handleFileChange} />
            <div className="mt-2 text-xs text-gray-500">
                * 한글이 깨지면 CSV를 UTF-8로 저장해 주세요.
            </div>
        </div>
    );
}
