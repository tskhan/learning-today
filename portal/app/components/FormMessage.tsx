import type { FormState } from "@/lib/forms";

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) return <p className="error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="notice" role="status">{state.ok}</p>;
  return null;
}
