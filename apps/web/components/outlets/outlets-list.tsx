"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError, type FieldErrors } from "@/lib/api/client";
import { listOutlets, type Outlet } from "@/lib/api/outlets";
import { canViewOutlets } from "@/lib/auth/roles";
import { readOutletsQuery } from "@/lib/validations/outlets";

type Draft = {
  search: string;
  code: string;
  location: string;
};

const emptyDraft: Draft = { search: "", code: "", location: "" };

export function OutletsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});

  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  const allowed = canViewOutlets(profile.data?.role);
  const parsed = readOutletsQuery({
    page: searchParams.get("page"),
    limit: searchParams.get("limit"),
    search: searchParams.get("search"),
    code: searchParams.get("code"),
    location: searchParams.get("location"),
  });

  const outlets = useQuery({
    queryKey: ["outlets", parsed.success ? parsed.data : null],
    queryFn: () => listOutlets(parsed.success ? parsed.data : { page: 1, limit: 20 }),
    enabled: allowed && parsed.success,
  });

  useEffect(() => {
    setDraft({
      search: searchParams.get("search") ?? "",
      code: searchParams.get("code") ?? "",
      location: searchParams.get("location") ?? "",
    });
  }, [searchParams]);

  useEffect(() => {
    if (outlets.error instanceof ApiError && outlets.error.status === 401) {
      router.replace("/login");
    }
  }, [outlets.error, router]);

  const apiFieldErrors =
    outlets.error instanceof ApiError ? outlets.error.fieldErrors : undefined;
  const queryErrors = parsed.success
    ? {}
    : flattenZodErrors(parsed.error.flatten().fieldErrors);
  const fieldErrors = { ...queryErrors, ...clientErrors, ...apiFieldErrors };

  function replaceParams(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = readOutletsQuery({
      page: "1",
      limit: searchParams.get("limit"),
      search: draft.search,
      code: draft.code,
      location: draft.location,
    });

    if (!result.success) {
      setClientErrors(flattenZodErrors(result.error.flatten().fieldErrors));
      return;
    }

    setClientErrors({});
    const params = new URLSearchParams();
    if (result.data.search) {
      params.set("search", result.data.search);
    }
    if (result.data.code) {
      params.set("code", result.data.code);
    }
    if (result.data.location) {
      params.set("location", result.data.location);
    }
    const limit = searchParams.get("limit");
    if (limit) {
      params.set("limit", limit);
    }
    replaceParams(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    replaceParams(params);
  }

  if (profile.isPending) {
    return <OutletsResultsSkeleton />;
  }

  if (!allowed) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Outlets</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to outlets.</p>
      </section>
    );
  }

  const pageError =
    outlets.error instanceof ApiError && !outlets.error.fieldErrors
      ? outlets.error.message
      : null;
  const list = outlets.data;
  const page = list?.page ?? (parsed.success ? parsed.data.page : 1);
  const limit = list?.limit ?? (parsed.success ? parsed.data.limit : 20);
  const total = list?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Outlets</h1>
        <p className="text-sm text-zinc-500">Outlets in your company.</p>
      </div>

      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={applyFilters}
      >
        <FilterField
          id="search"
          label="Search"
          placeholder="Name, code, or location"
          value={draft.search}
          error={fieldErrors.search?.[0]}
          onChange={(search) => setDraft((current) => ({ ...current, search }))}
        />
        <FilterField
          id="code"
          label="Code"
          placeholder="OUT-001"
          value={draft.code}
          error={fieldErrors.code?.[0]}
          onChange={(code) => setDraft((current) => ({ ...current, code }))}
        />
        <FilterField
          id="location"
          label="Location"
          placeholder="Downtown"
          value={draft.location}
          error={fieldErrors.location?.[0]}
          onChange={(location) => setDraft((current) => ({ ...current, location }))}
        />
        <div className="flex items-end">
          {outlets.isFetching ? (
            <Skeleton className="h-11 w-full" />
          ) : (
            <Button type="submit" className="w-full">
              Apply
            </Button>
          )}
        </div>
        {fieldErrors.page?.[0] ? (
          <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4 dark:text-red-400">
            {fieldErrors.page[0]}
          </p>
        ) : null}
        {fieldErrors.limit?.[0] ? (
          <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4 dark:text-red-400">
            {fieldErrors.limit[0]}
          </p>
        ) : null}
      </form>

      {pageError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{pageError}</p>
      ) : null}

      {outlets.isFetching ? (
        <OutletsResultsSkeleton />
      ) : !parsed.success || outlets.isError ? null : list && list.items.length > 0 ? (
        <OutletResults items={list.items} />
      ) : (
        <p className="text-sm text-zinc-500">No outlets found.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500">
          {total === 0 ? "0 outlets" : `${from}–${to} of ${total}`}
        </p>
        <div className="flex gap-2">
          <Button disabled={page <= 1 || outlets.isFetching} onClick={() => goToPage(page - 1)}>
            Previous
          </Button>
          <Button
            disabled={page * limit >= total || outlets.isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterField({
  id,
  label,
  placeholder,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function OutletResults({ items }: { items: Outlet[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 md:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {items.map((outlet) => (
              <tr key={outlet.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3 font-medium">{outlet.name}</td>
                <td className="px-4 py-3">{outlet.code}</td>
                <td className="px-4 py-3">{outlet.location ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((outlet) => (
          <li
            key={outlet.id}
            className="rounded-xl border border-zinc-200 bg-background p-4 dark:border-zinc-800"
          >
            <p className="font-medium">{outlet.name}</p>
            <p className="mt-1 text-sm text-zinc-500">{outlet.code}</p>
            <p className="mt-1 text-sm">{outlet.location ?? "—"}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

export function OutletsResultsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

function flattenZodErrors(errors: Record<string, string[] | undefined>): FieldErrors {
  const flattened: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (messages && messages.length > 0) {
      flattened[field] = messages;
    }
  }
  return flattened;
}
