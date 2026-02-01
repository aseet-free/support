import { LAST_UPDATED, UPDATE_NOTE } from "../lib/siteMeta";

export default function UpdateLine() {
    return (
        <div className="text-xs text-gray-500">
            {LAST_UPDATED} 업데이트 완료 ({UPDATE_NOTE})
        </div>
    );
}
