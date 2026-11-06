"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEventHandler, type FocusEventHandler, type Ref } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listMenuItems } from "@/lib/api/menu-items";
import { assignOutletMenuItem } from "@/lib/api/outlet-menu-items";
import { listOutlets } from "@/lib/api/outlets";
import { canManageOutletMenus } from "@/lib/auth/roles";
import {
  assignOutletMenuItemSchema,
  type AssignOutletMenuItemValues,
} from "@/lib/validations/outlet-menu-items";

export function AssignOutletMenuItem() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });

  useEffect(() => {
    if (profile.error instanceof ApiError && profile.error.status === 401) {
      router.replace("/login");
    }
  }, [profile.error, router]);

  if (profile.isPending) {
    return <AssignSkeleton />;
  }

  if (!canManageOutletMenus(profile.data?.role)) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Assign menu item</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to assign outlet menu items.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assign menu item</h1>
          <p className="text-sm text-zinc-500">Choose an outlet and a menu item. Price override is optional.</p>
        </div>
        <Link href="/outlet-menu-items" className="text-sm font-medium text-zinc-500 hover:text-foreground">
          Back to outlet menus
        </Link>
      </div>
      <AssignForm
        onAssigned={async (message) => {
          toast.success(message || "Menu item assigned");
          await queryClient.invalidateQueries({ queryKey: ["outlet-menu-items"] });
          router.push("/outlet-menu-items");
        }}
      />
    </section>
  );
}

function AssignForm({ onAssigned }: { onAssigned: (message: string) => Promise<void> }) {
  const router = useRouter();
  const [outletSearch, setOutletSearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const outlets = useQuery({
    queryKey: ["outlets", "picker", outletSearch],
    queryFn: () => listOutlets({ page: 1, limit: 20, search: outletSearch.trim() || undefined }),
  });
  const menuItems = useQuery({
    queryKey: ["menu-items", "picker", menuSearch],
    queryFn: () => listMenuItems({ page: 1, limit: 20, search: menuSearch.trim() || undefined }),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<AssignOutletMenuItemValues>({
    resolver: zodResolver(assignOutletMenuItemSchema),
    defaultValues: { outletId: "", menuItemId: "", outletPrice: "", isActive: false },
  });
  const assign = useMutation({
    mutationFn: assignOutletMenuItem,
    onSuccess: async (response) => {
      setFormError(null);
      await onAssigned(response.message);
    },
  });

  useEffect(() => {
    if (assign.error instanceof ApiError && assign.error.status === 401) {
      router.replace("/login");
    }
  }, [assign.error, router]);

  useEffect(() => {
    if (!(assign.error instanceof ApiError) || assign.error.status === 401) {
      return;
    }
    if (!assign.error.fieldErrors) {
      setFormError(assign.error.message);
      return;
    }
    setFormError(null);
    for (const field of ["outletId", "menuItemId", "outletPrice", "isActive"] as const) {
      const message = assign.error.fieldErrors[field]?.[0];
      if (message) {
        setError(field, { message });
      }
    }
  }, [assign.error, setError]);

  return (
    <form
      className="grid max-w-3xl gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-2 dark:border-zinc-800"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        assign.mutate({
          outletId: values.outletId,
          menuItemId: values.menuItemId,
          isActive: values.isActive,
          ...(values.outletPrice.trim() === "" ? {} : { outletPrice: Number(values.outletPrice) }),
        });
      })}
    >
      <SearchableSelect
        id="outletId"
        label="Outlet"
        search={outletSearch}
        onSearch={setOutletSearch}
        options={(outlets.data?.items ?? []).map((outlet) => ({
          id: outlet.id,
          label: outlet.name,
        }))}
        error={isSubmitted ? errors.outletId?.message : undefined}
        {...register("outletId")}
      />
      <SearchableSelect
        id="menuItemId"
        label="Menu item"
        search={menuSearch}
        onSearch={setMenuSearch}
        options={(menuItems.data?.items ?? []).map((item) => ({
          id: item.id,
          label: item.name,
        }))}
        error={isSubmitted ? errors.menuItemId?.message : undefined}
        {...register("menuItemId")}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="outletPrice">Price override</Label>
        <Input
          id="outletPrice"
          inputMode="decimal"
          placeholder="Optional"
          aria-invalid={Boolean(isSubmitted && errors.outletPrice)}
          {...register("outletPrice")}
        />
        {isSubmitted && errors.outletPrice?.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.outletPrice.message}</p>
        ) : null}
      </div>
      <label className="flex h-11 items-end gap-2 text-sm">
        <input type="checkbox" className="size-4" {...register("isActive")} />
        Active
      </label>
      {formError ? (
        <p className="text-sm text-red-600 md:col-span-2 dark:text-red-400">{formError}</p>
      ) : null}
      <div className="md:col-span-2">
        {assign.isPending ? <Skeleton className="h-11 w-32" /> : <Button type="submit">Assign</Button>}
      </div>
    </form>
  );
}

function SearchableSelect({
  id,
  label,
  search,
  onSearch,
  options,
  error,
  name,
  onChange,
  onBlur,
  ref,
}: {
  id: string;
  label: string;
  search: string;
  onSearch: (value: string) => void;
  options: { id: string; label: string }[];
  error?: string;
  name: string;
  onChange: ChangeEventHandler<HTMLSelectElement>;
  onBlur: FocusEventHandler<HTMLSelectElement>;
  ref: Ref<HTMLSelectElement>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-search`}>{label}</Label>
      <Input
        id={`${id}-search`}
        value={search}
        placeholder={`Search ${label.toLowerCase()}`}
        onChange={(event) => onSearch(event.target.value)}
      />
      <select
        id={id}
        name={name}
        ref={ref}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={Boolean(error)}
        className="h-11 rounded-lg border border-zinc-300 bg-background px-3 text-sm dark:border-zinc-700"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function AssignSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
