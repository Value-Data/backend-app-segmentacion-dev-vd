import { Suspense } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function AppLayout() {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto p-6 bg-garces-cream">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-garces-cherry" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
