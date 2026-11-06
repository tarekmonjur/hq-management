"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import type { MenuItem } from "@/lib/api/menu-items";
import {
  MENU_ITEM_UNITS,
  menuItemFormSchema,
  toMenuItemPayload,
  type MenuItemFormValues,
  type MenuItemPayload,
} from "@/lib/validations/menu-items";

export function menuItemFormValues(item?: MenuItem | null): MenuItemFormValues {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    basePrice: item?.basePrice == null ? "" : String(item.basePrice),
    unit: item?.unit ?? "",
  };
}

const formFields = ["name", "description", "basePrice", "unit"] as const;

export function MenuItemForm({
  initial,
  submitLabel,
  pending,
  error,
  onSubmit,
}: {
  initial?: MenuItem | null;
  submitLabel: string;
  pending: boolean;
  error: unknown;
  onSubmit: (payload: MenuItemPayload) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: menuItemFormValues(initial),
  });

  useEffect(() => {
    if (!(error instanceof ApiError)) {
      setFormError(error instanceof Error ? error.message : null);
      return;
    }

    if (!error.fieldErrors) {
      setFormError(error.message);
      return;
    }

    setFormError(null);
    for (const field of formFields) {
      const message = error.fieldErrors[field]?.[0];
      if (message) {
        setError(field, { message });
      }
    }
  }, [error, setError]);

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      noValidate
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        onSubmit(toMenuItemPayload(values));
      })}
    >
      <Field label="Name" htmlFor="name" error={isSubmitted ? errors.name?.message : undefined}>
        <Input id="name" aria-invalid={Boolean(isSubmitted && errors.name)} {...register("name")} />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        error={isSubmitted ? errors.description?.message : undefined}
      >
        <textarea
          id="description"
          rows={4}
          className="w-full rounded-lg border border-zinc-300 bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-zinc-400 focus:border-foreground dark:border-zinc-700"
          aria-invalid={Boolean(isSubmitted && errors.description)}
          {...register("description")}
        />
      </Field>
      <Field
        label="Base price"
        htmlFor="basePrice"
        error={isSubmitted ? errors.basePrice?.message : undefined}
      >
        <Input
          id="basePrice"
          inputMode="decimal"
          placeholder="0.00"
          aria-invalid={Boolean(isSubmitted && errors.basePrice)}
          {...register("basePrice")}
        />
      </Field>
      <Field label="Unit" htmlFor="unit" error={isSubmitted ? errors.unit?.message : undefined}>
        <select
          id="unit"
          className="h-11 w-full rounded-lg border border-zinc-300 bg-background px-3 text-sm text-foreground outline-none focus:border-foreground dark:border-zinc-700"
          aria-invalid={Boolean(isSubmitted && errors.unit)}
          {...register("unit")}
        >
          <option value="">No unit</option>
          {MENU_ITEM_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </Field>
      {formError ? <p className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}
      {pending ? <Skeleton className="h-11 w-40" /> : <Button type="submit">{submitLabel}</Button>}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
