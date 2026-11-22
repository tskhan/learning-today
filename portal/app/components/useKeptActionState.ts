"use client";
import { useActionState } from "react";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * useActionState that remembers what was typed when the action returns an error.
 * React resets a form after every action; forms use `state.values` as their
 * defaultValues so the reset puts the typed text back instead of clearing it.
 * Only the named fields are kept (never passwords).
 */
export function useKeptActionState(action: Action, keep: string[]) {
  return useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (!result?.error) return result;
    const values: Record<string, string> = {};
    for (const name of keep) {
      const v = fd.get(name);
      if (typeof v === "string") values[name] = v;
    }
    return { ...result, values };
  }, undefined);
}
