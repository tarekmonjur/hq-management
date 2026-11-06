"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { loginRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { loginSchema, type LoginValues } from "@/lib/validations/login";

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const login = useMutation({
    mutationFn: loginRequest,
    onSuccess: (response) => {
      toast.success(response.message || "Logged in successfully");
      router.push("/dashboard");
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fieldErrors) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if (field === "email" || field === "password") {
            setError(field, { message: messages[0] });
          }
        }
        setFormError(null);
        return;
      }

      setFormError(error instanceof Error ? error.message : "Login failed");
    },
  });

  return (
    <form
      className="flex w-full flex-col gap-5"
      onSubmit={handleSubmit((values) => {
        setFormError(null);
        login.mutate(values);
      })}
      noValidate
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {isSubmitted && errors.email?.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {isSubmitted && errors.password?.message ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
      ) : null}

      {login.isPending ? (
        <Skeleton className="h-11 w-full" />
      ) : (
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      )}
    </form>
  );
}
