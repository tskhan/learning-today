"use client";
import Link from "next/link";
import { useKeptActionState } from "./useKeptActionState";
import { markHomework, unmarkHomework } from "@/app/(member)/classes/actions";
import { FormMessage } from "./FormMessage";
import { SubmitButton } from "./SubmitButton";

export interface MyStatus { handinUrl: string | null; note: string | null }

export function HomeworkControl({ homeworkId, handinExpected, status, editing, returnTo }: {
  homeworkId: number;
  handinExpected: boolean;
  status: MyStatus | null;
  editing: boolean;
  returnTo: string;
}) {
  const [state, action] = useKeptActionState(markHomework, ["handin_url", "note"]);
  const hidden = (
    <>
      <input type="hidden" name="homework_id" value={homeworkId} />
      <input type="hidden" name="return_to" value={returnTo} />
    </>
  );
  const undo = (
    <form action={unmarkHomework}>
      {hidden}
      <button type="submit" className="link-button">Undo</button>
    </form>
  );

  if (!handinExpected) {
    if (status) {
      return (
        <div className="row hw-control">
          <span className="badge badge-done">Done ✓</span>
          {undo}
        </div>
      );
    }
    return (
      <form action={action} className="hw-control">
        {hidden}
        <FormMessage state={state?.error ? state : undefined} />
        <SubmitButton className="btn" pendingText="Saving…">Mark as done</SubmitButton>
      </form>
    );
  }

  if (status && !editing) {
    return (
      <div className="hw-control stack" style={{ gap: "0.25rem" }}>
        <p style={{ margin: 0 }}>
          <span className="badge badge-done">Handed in</span>{" "}
          <a href={status.handinUrl ?? "#"} target="_blank" rel="noopener nofollow">{status.handinUrl}</a>
        </p>
        {status.note ? <p className="small muted" style={{ margin: 0 }}>{status.note}</p> : null}
        <div className="row">
          <Link href={`${returnTo}?edit=hw-${homeworkId}#hw-${homeworkId}`}>Edit hand-in</Link>
          {undo}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="hw-control">
      {hidden}
      {editing ? <input type="hidden" name="editing" value="1" /> : null}
      <FormMessage state={state?.error ? state : undefined} />
      <div className="form-row">
        <label htmlFor={`handin-${homeworkId}`}>Link to your work</label>
        <input id={`handin-${homeworkId}`} name="handin_url" type="url" inputMode="url" placeholder="https://…" defaultValue={state?.values?.handin_url ?? status?.handinUrl ?? ""} />
      </div>
      <div className="form-row">
        <label htmlFor={`note-${homeworkId}`}>Note (optional)</label>
        <input id={`note-${homeworkId}`} name="note" type="text" maxLength={500} defaultValue={state?.values?.note ?? status?.note ?? ""} />
      </div>
      <div className="row">
        <SubmitButton pendingText="Handing in…">Hand in</SubmitButton>
        {editing ? <Link className="btn-quiet" href={`${returnTo}#hw-${homeworkId}`}>Cancel</Link> : null}
      </div>
    </form>
  );
}
