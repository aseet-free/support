"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
    { href: "/", label: "추천" },
    { href: "/price-level", label: "가격수준" },
    { href: "/gu-index", label: "지수" },
];

export default function Nav() {
    const pathname = usePathname();

    return (
        <nav className="flex gap-2">
            {tabs.map((t) => {
                const active = pathname === t.href;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        className={[
                            "px-3 py-2 rounded-xl border text-sm",
                            active ? "bg-black text-white border-black" : "bg-white text-gray-700",
                        ].join(" ")}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
