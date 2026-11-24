"use client";
import { useKeptActionState } from "@/app/components/useKeptActionState";
import { createThread } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";
import { Composer } from "@/app/components/Composer";
import { keptImages } from "@/app/components/keptImages";

export function NewThreadForm({ classes, defaultClassId }: { classes: Array<{ id: number; number: number; title: string }>; defaultClassId?: number }) {
  const [state, action] = useKeptActionState(createThread, ["title", "body", "images", "class_id"]);
  const v = state?.values ?? {};
  return (
    <form action={action}>
      <FormMessage state={state} />
      <div className="form-row">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={150} defaultValue={v.title ?? ""} required />
      </div>
      <Composer
        id="body"
        label="Message"
        name="body"
        imagesName="images"
        initialMarkdown={v.body ?? ""}
        initialImages={keptImages(v.images)}
        placeholder="What would you like to ask or share?"
        minHeight="10rem"
      />
      <div className="form-row">
        <label htmlFor="class_id">About a class (optional)</label>
        <select key={`class-${v.class_id ?? ""}`} id="class_id" name="class_id" defaultValue={v.class_id ?? defaultClassId ?? ""}>
          <option value="">General</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>Class {c.number}: {c.title}</option>
          ))}
        </select>
      </div>
      <SubmitButton pendingText="Posting…">Post discussion</SubmitButton>
    </form>
  );
}
