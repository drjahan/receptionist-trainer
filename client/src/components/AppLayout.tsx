import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  LayoutDashboard,
  History,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";

const navItems = [
  { href: "/scenarios", label: "Scenarios", icon: BookOpen },
  { href: "/history", label: "My Progress", icon: History },
];

const adminItems = [
  { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  const isAdmin = user?.role === "admin";

  const allNavItems = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur-sm">
        <div className="container">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <img
                src="/manus-storage/gp-pathfinder-logo_dfe74db8.png"
                alt="GP Pathfinder Ai"
                className="h-9 w-auto object-contain"
              />
            </Link>

            {/* Desktop nav */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-1">
                {allNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      location === item.href || location.startsWith(item.href + "/")
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            )}

            {/* Right side */}
            <div className="flex items-center gap-3">
              {loading ? null : isAuthenticated ? (
                <>
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-primary">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground hidden lg:block">{user?.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:flex gap-2 text-muted-foreground"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setMobileOpen(!mobileOpen)}
                  >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </Button>
                </>
              ) : (
                <Button asChild size="sm" className="bg-primary text-primary-foreground">
                  <a href={getLoginUrl()}>Sign in</a>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && isAuthenticated && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
            {allNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  location === item.href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => logoutMutation.mutate()}
              className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="container">
          <p className="text-xs text-muted-foreground text-center">
            GP Pathfinder Clinics — Receptionist Training Platform · Confidential
          </p>
        </div>
      </footer>
    </div>
  );
}
