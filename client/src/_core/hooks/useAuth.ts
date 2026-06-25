import { trpc } from "@/lib/trpc";
import { useCallback, useState } from "react";

export function useAuth() {
  const { data: user, isLoading, error, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  const isAuthenticated = !!user;

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore
    }
    refetch();
    window.location.href = "/login";
  }, [refetch]);

  return {
    user: user ?? null,
    loading: isLoading,
    error,
    isAuthenticated,
    logout,
  };
}
