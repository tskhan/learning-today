"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { saveClass } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { Composer } from "@/app/components/Composer";
import { ConfirmDialog } from "@/app/components/Modal";
import type { AttachedImage } from "@/lib/images";

export interface MaterialRow { key: string; label: string; url: string }
export interface HomeworkRow { key: string; id: number | null; title: string; instructions: string; images: AttachedImage[]; deadline: string; handin: boolean }
export interface ClassFormValues {
  id: number | null;
  number: string;
  classDate: string;
  title: string;
  summary: string;
  summaryImages: AttachedImage[];
  status: "draft" | "published";
  materials: MaterialRow[];
  homework: HomeworkRow[];
}

let seq = 0;
const newKey = () => `new-${++seq}`;

export function ClassForm({ initial }: { initial: ClassFormValues }) {
  const [state, action, saving] = useActionState(saveClass, undefined);
  const [, startSave] = useTransition();
  const [materials, setMaterials] = useState<MaterialRow[]>(initial.materials);
  const [homework, setHomework] = useState<HomeworkRow[]>(initial.homework);
  // Fields are controlled so an error message never wipes what the admin typed.
  const [number, setNumber] = useState(initial.number);
  const [classDate, setClassDate] = useState(initial.classDate);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState(initial.status);
  const setMaterial = (i: number, patch: Partial<MaterialRow>) =>
    setMaterials((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const [removing, setRemoving] = useState<number | null>(null);
  const setHw = (i: number, patch: Partial<HomeworkRow>) =>
    setHomework((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form
      onSubmit={(e) => {
        // Submit without React's automatic form reset, so nothing typed is lost on an error.
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startSave(() => action(fd));
      }}
    >
      <FormMessage state={state} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="form-row" style={{ flex: "1 1 8rem" }}>
          <label htmlFor="number">Class number</label>
          <input id="number" name="number" type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} required />
        </div>
        <div className="form-row" style={{ flex: "1 1 10rem" }}>
          <label htmlFor="class_date">Date</label>
          <input id="class_date" name="class_date" type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} required />
        </div>
        <div className="form-row" style={{ flex: "1 1 10rem" }}>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
            <option value="draft">Draft (only admins see it)</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      {/* The editor keeps its own text and pictures, so an error never wipes them. */}
      <Composer
        id="summary_md"
        label="What was discussed"
        name="summary_md"
        imagesName="summary_images"
        initialMarkdown={initial.summary}
        initialImages={initial.summaryImages}
        headings
        minHeight="12rem"
      />

      <fieldset className="section" style={{ border: 0, padding: 0 }}>
        <legend><h2>Material</h2></legend>
        {materials.map((m, i) => (
          <div key={m.key} className="repeat">
            <div className="form-row">
              <label htmlFor={`ml-${m.key}`}>Material label</label>
              <input id={`ml-${m.key}`} name="material_label" type="text" maxLength={150} value={m.label} onChange={(e) => setMaterial(i, { label: e.target.value })} />
            </div>
            <div className="form-row">
              <label htmlFor={`mu-${m.key}`}>Material link</label>
              <input id={`mu-${m.key}`} name="material_url" type="url" value={m.url} onChange={(e) => setMaterial(i, { url: e.target.value })} placeholder="https://…" />
            </div>
            <button type="button" className="link-button danger" onClick={() => setMaterials(materials.filter((_, j) => j !== i))}>
              Remove material
            </button>
          </div>
        ))}
        <button type="button" className="btn-quiet" onClick={() => setMaterials([...materials, { key: newKey(), label: "", url: "" }])}>
          Add material
        </button>
      </fieldset>

      <fieldset className="section" style={{ border: 0, padding: 0 }}>
        <legend><h2>Homework</h2></legend>
        {homework.map((h, i) => (
          <div key={h.key} className="repeat">
            <input type="hidden" name="hw_id" value={h.id ?? ""} />
            <div className="form-row">
              <label htmlFor={`ht-${h.key}`}>Homework title</label>
              <input id={`ht-${h.key}`} name="hw_title" type="text" maxLength={150} value={h.title} onChange={(e) => setHw(i, { title: e.target.value })} />
            </div>
            <Composer
              id={`hi-${h.key}`}
              label="Instructions"
              name="hw_instructions"
              imagesName="hw_images"
              initialMarkdown={h.instructions}
              initialImages={h.images}
              minHeight="5rem"
            />
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="form-row" style={{ flex: "1 1 12rem" }}>
                <label htmlFor={`hd-${h.key}`}>Deadline (Pakistan time)</label>
                <input id={`hd-${h.key}`} name="hw_deadline" type="datetime-local" value={h.deadline} onChange={(e) => setHw(i, { deadline: e.target.value })} />
                <span className="hint">Leave empty for no deadline.</span>
              </div>
              <div className="form-row" style={{ flex: "1 1 12rem" }}>
                <label htmlFor={`hh-${h.key}`}>Hand-in link expected?</label>
                <select id={`hh-${h.key}`} name="hw_handin" value={h.handin ? "yes" : "no"} onChange={(e) => setHw(i, { handin: e.target.value === "yes" })}>
                  <option value="no">No: students just mark it done</option>
                  <option value="yes">Yes: students hand in a link</option>
                </select>
                {h.id ? <span className="hint">Switching to Yes clears earlier &ldquo;done&rdquo; ticks that have no link.</span> : null}
              </div>
            </div>
            <button
              type="button"
              className="link-button danger"
              onClick={() => {
                // Saved homework may have hand-ins: ask first. New, unsaved homework just goes.
                if (h.id) setRemoving(i);
                else setHomework(homework.filter((_, j) => j !== i));
              }}
            >
              Remove homework
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setHomework([...homework, { key: newKey(), id: null, title: "", instructions: "", images: [], deadline: "", handin: false }])}
        >
          Add homework
        </button>
      </fieldset>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this homework?"
        message="Everyone's hand-ins for it will be deleted when you save the class."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          setHomework((rows) => rows.filter((_, j) => j !== removing));
          setRemoving(null);
        }}
      />

      <div className="row section">
        <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save class"}</button>
        <Link className="btn-quiet" href="/admin/classes">Cancel</Link>
      </div>
    </form>
  );
}
