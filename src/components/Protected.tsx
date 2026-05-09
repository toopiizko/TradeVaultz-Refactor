import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

export default function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}
