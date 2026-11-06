import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-zinc-500">Nothing here yet.</p>
    </section>
  );
}
