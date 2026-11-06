"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LayoutDashboard, LogOut, Menu, Store, UtensilsCrossed, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest, logoutRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { canViewOutlets } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function Sidebar({
  pathname,
  onNavigate,
  profilePending,
  items,
  fullName,
  email,
  logoutPending,
  onLogout,
}: {
  pathname: string;
  onNavigate: () => void;
  profilePending: boolean;
  items: NavItem[];
  fullName?: string;
  email?: string;
  logoutPending: boolean;
  onLogout: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <span className="text-sm font-semibold tracking-tight">HQ Management</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                active
                  ? "bg-foreground text-background"
                  : "text-zinc-700 hover:bg-zinc-200/70 dark:text-zinc-200 dark:hover:bg-zinc-800",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        {profilePending ? (
          <div className="flex flex-col gap-2 px-2 py-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : (
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium">{fullName ?? "Account"}</p>
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>
        )}
        {logoutPending ? (
          <Skeleton className="mt-2 h-11 w-full" />
        ) : (
          <Button
            className="mt-2 w-full bg-transparent text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
            onClick={onLogout}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Log out
          </Button>
        )}
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.status === 401) {
      router.replace("/login");
    }
  }, [profile.error, router]);

  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: (response) => {
      toast.success(response.message || "Logged out successfully");
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Logout failed");
    },
  });

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  ];
  items.push({ href: "/menu-items", label: "Menu items", icon: UtensilsCrossed });
  items.push({ href: "/outlet-menu-items", label: "Outlet menus", icon: ClipboardList });
  if (canViewOutlets(profile.data?.role)) {
    items.push({ href: "/outlets", label: "Outlets", icon: Store });
  }

  const sidebarProps = {
    pathname,
    onNavigate: () => setMenuOpen(false),
    profilePending: profile.isPending,
    items,
    fullName: profile.data?.fullName,
    email: profile.data?.email,
    logoutPending: logout.isPending,
    onLogout: () => logout.mutate(),
  };

  return (
    <div className="flex min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-background md:block dark:border-zinc-800">
        <Sidebar {...sidebarProps} />
      </aside>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-zinc-200 bg-background dark:border-zinc-800">
            <Sidebar {...sidebarProps} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-zinc-200 bg-background px-4 md:hidden dark:border-zinc-800">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <span className="text-sm font-semibold">HQ Management</span>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
