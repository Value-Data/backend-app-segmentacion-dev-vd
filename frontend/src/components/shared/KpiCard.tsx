import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  iconBg?: string;
  iconColor?: string;
}

export function KpiCard({ title, value, icon: Icon, trend, className, iconBg, iconColor }: KpiCardProps) {
  return (
    <div className={cn("bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
        </div>
        <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", iconBg || "bg-garces-cherry-pale")}>
          <Icon className={cn("h-5 w-5", iconColor || "text-garces-cherry")} />
        </div>
      </div>
    </div>
  );
}
