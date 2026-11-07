"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { MenuItemForm } from "@/components/menu-items/menu-item-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { currentUserRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItem,
  updateMenuItem,
} from "@/lib/api/menu-items";
import { canManageMenuItems } from "@/lib/auth/roles";
import type { MenuItemPayload } from "@/lib/validations/menu-items";

export function CreateMenuItem() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const create = useMutation({
    mutationFn: createMenuItem,
    onSuccess: async (response) => {
      toast.success(response.message || "Menu item created");
      await queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      router.push("/menu-items");
    },
  });

  if (profile.isPending) {
    return <EditorSkeleton />;
  }

  if (!canManageMenuItems(profile.data?.role)) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">New menu item</h1>
        <p className="text-sm text-zinc-500">You don&apos;t have access to create menu items.</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New menu item</h1>
      <MenuItemForm
        submitLabel="Create"
        pending={create.isPending}
        error={create.error}
        onSubmit={(payload) => create.mutate(payload)}
      />
    </section>
  );
}

export function MenuItemDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: currentUserRequest,
  });
  const item = useQuery({
    queryKey: ["menu-items", "detail", id],
    queryFn: () => getMenuItem(id),
  });

  useEffect(() => {
    if (item.error instanceof ApiError && item.error.status === 401) {
      router.replace("/login");
    }
  }, [item.error, router]);

  const save = useMutation({
    mutationFn: (payload: MenuItemPayload) => updateMenuItem(id, payload),
    onSuccess: async (response) => {
      toast.success(response.message || "Menu item updated");
      await queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      router.push("/menu-items");
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteMenuItem(id),
    onSuccess: async (response) => {
      toast.success(response.message || "Menu item deleted");
      await queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      router.push("/menu-items");
    },
  });

  if (item.isPending || profile.isPending) {
    return <EditorSkeleton />;
  }

  if (item.error instanceof ApiError) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Menu item</h1>
        <p className="text-sm text-red-600 dark:text-red-400">{item.error.message}</p>
      </section>
    );
  }

  if (!item.data) {
    return null;
  }

  const canManage = canManageMenuItems(profile.data?.role);
  const deleteError =
    remove.error instanceof ApiError && !remove.error.fieldErrors ? remove.error.message : null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{item.data.name}</h1>
        <p className="text-sm text-zinc-500">
          {canManage ? "Update this menu item." : "Menu item details."}
        </p>
      </div>

      {canManage ? (
        <MenuItemForm
          key={item.data.updatedAt}
          initial={item.data}
          submitLabel="Save"
          pending={save.isPending}
          error={save.error}
          onSubmit={(payload) => save.mutate(payload)}
        />
      ) : (
        <dl className="grid max-w-xl gap-4 text-sm">
          <Detail label="Name" value={item.data.name} />
          <Detail label="Description" value={item.data.description ?? "—"} />
          <Detail
            label="Base price"
            value={item.data.basePrice == null ? "—" : String(item.data.basePrice)}
          />
          <Detail label="Unit" value={item.data.unit ?? "—"} />
        </dl>
      )}

      {canManage ? (
        <div className="flex max-w-xl flex-col gap-3 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          {deleteError ? <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p> : null}
          {remove.isPending ? (
            <Skeleton className="h-11 w-40" />
          ) : confirmingDelete ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => remove.mutate()}>Confirm delete</Button>
              <Button
                className="bg-transparent text-foreground hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              className="bg-transparent text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-zinc-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function EditorSkeleton() {
  return (
    <div className="flex max-w-xl flex-col gap-4" aria-hidden="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-40" />
    </div>
  );
}
