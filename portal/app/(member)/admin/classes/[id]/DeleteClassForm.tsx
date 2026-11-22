"use client";
import { useActionState } from "react";
import { deleteClass } from "../../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

export function DeleteClassForm({ id }: { id: number }) {
  const [state, action] = useActionState(deleteClass, undefined);
  return (
    <form action={action} className="card danger-zone">
      <h2>Delete this class</h2>
      <p className="small">This deletes the class, its homework, everyone&apos;s hand-ins for it and its question thread. It can&apos;t be undone.</p>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="form-row">
        <label htmlFor="confirm">Type the class number to confirm</label>
        <input id="confirm" name="confirm" type="text" inputMode="numeric" autoComplete="off" />
      </div>
      <SubmitButton className="btn-quiet btn-danger" pendingText="Deleting…">Delete class</SubmitButton>
    </form>
  );
}
