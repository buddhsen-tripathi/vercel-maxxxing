"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "New Review" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground text-xs font-bold">
            CR
          </div>
          <span className="font-semibold text-sm">CodeReview</span>
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <Button
            key={item.href}
            variant="ghost"
            className={cn(
              "justify-start",
              pathname === item.href && "bg-muted"
            )}
            asChild
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>
    </aside>
  );
}
