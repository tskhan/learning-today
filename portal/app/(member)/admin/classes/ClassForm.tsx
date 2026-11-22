"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { previewMarkdown, saveClass } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";

export interface MaterialRow { key: string; label: string; url: string }
export interface HomeworkRow { key: string; id: number | null; title: string; instructions: string; deadline: string; handin: boolean }
export interface ClassFormValues {
  id: number | null;
  number: string;
  classDate: string;
  title: string;
  summary: string;
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
  const [summary, setSummary] = useState(initial.summary);
  // Fields are controlled so an error message never wipes what the admin typed.
  const [number, setNumber] = useState(initial.number);
  const [classDate, setClassDate] = useState(initial.classDate);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState(initial.status);
  const setMaterial = (i: number, patch: Partial<MaterialRow>) =>
    setMaterials((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setHw = (i: number, patch: Partial<HomeworkRow>) =>
    setHomework((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

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
      <div className="form-row">
        <label htmlFor="summary_md">What was discussed</label>
        <textarea id="summary_md" name="summary_md" rows={10} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <span className="hint">Markdown works: ## headings, - lists, **bold**, [links](https://…).</span>
        <div>
          <button
            type="button"
            className="btn-quiet"
            disabled={previewing}
            onClick={() => startPreview(async () => setPreview(await previewMarkdown(summary)))}
          >
            Preview summary
          </button>
        </div>
      </div>
      {preview !== null ? <div className="preview prose" dangerouslySetInnerHTML={{ __html: preview || "<p>(empty)</p>" }} /> : null}

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
            <div className="form-row">
              <label htmlFor={`hi-${h.key}`}>Instructions</label>
              <textarea id={`hi-${h.key}`} name="hw_instructions" rows={4} value={h.instructions} onChange={(e) => setHw(i, { instructions: e.target.value })} />
            </div>
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
                if (h.id && !window.confirm("Remove this homework? Everyone's hand-ins for it will be deleted when you save.")) return;
                setHomework(homework.filter((_, j) => j !== i));
              }}
            >
              Remove homework
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn-quiet"
          onClick={() => setHomework([...homework, { key: newKey(), id: null, title: "", instructions: "", deadline: "", handin: false }])}
        >
          Add homework
        </button>
      </fieldset>

      <div className="row section">
        <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save class"}</button>
        <Link className="btn-quiet" href="/admin/classes">Cancel</Link>
      </div>
    </form>
  );
}
