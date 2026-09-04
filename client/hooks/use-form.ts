"use client";

import { useCallback, useState } from "react";

import { apiError } from "@/lib/api";

type Errors<T> = Partial<Record<keyof T, string>>;

/**
 * Small controlled-form helper: field values, validation errors (shown after a
 * submit attempt), a submit guard, and a top-level error slot for API failures.
 */
export function useForm<T extends Record<string, string>>(config: {
  initial: T;
  validate: (values: T) => Errors<T>;
  onSubmit: (values: T) => Promise<void>;
}) {
  const { initial, validate, onSubmit } = config;
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const field = useCallback(
    (name: keyof T) => ({
      value: values[name],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.value;
        setValues((current) => ({ ...current, [name]: next }));
        setFormError(null);
      },
    }),
    [values]
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const found = Object.fromEntries(
        Object.entries(validate(values)).filter(([, message]) => Boolean(message))
      ) as Errors<T>;
      setErrors(found);
      if (Object.keys(found).length > 0) return;

      setSubmitting(true);
      setFormError(null);
      onSubmit(values)
        .catch((err) =>
          setFormError(err instanceof Error ? err.message : apiError(err))
        )
        .finally(() => setSubmitting(false));
    },
    [validate, onSubmit, values]
  );

  return { values, errors, field, formError, submitting, handleSubmit, setFormError };
}
