import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-background p-6 shadow-sm sm:p-8 dark:border-zinc-800">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-500">HQ Management</p>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-500">
            Use your account email and password to continue.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
