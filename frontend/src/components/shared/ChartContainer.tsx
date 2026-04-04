import { ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  height?: number;
}

export function ChartContainer({ title, children, height = 300 }: ChartContainerProps) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}
