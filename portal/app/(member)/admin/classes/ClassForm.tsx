"use client";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { previewMarkdown, saveClass } from "../actions";
import { FormMessage } from "@/app/components/FormMessage";
import { SubmitButton } from "@/app/components/SubmitButton";

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
  const [state, action] = useActionState(saveClass, undefined);
  const [materials, setMaterials] = useState<MaterialRow[]>(initial.materials);
  const [homework, setHomework] = useState<HomeworkRow[]>(initial.homework);
  const [summary, setSummary] = useState(initial.summary);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();

  return (
    <form action={action}>
      <FormMessage state={state} />
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="form-row" style={{ flex: "1 1 8rem" }}>
          <label htmlFor="number">Class number</label>
          <input id="number" name="number" type="number" min={1} defaultValue={initial.number} required />
        </div>
        <div className="form-row" style={{ flex: "1 1 10rem" }}>
          <label htmlFor="class_date">Date</label>
          <input id="class_date" name="class_date" type="date" defaultValue={initial.classDate} required />
        </div>
        <div className="form-row" style={{ flex: "1 1 10rem" }}>
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={initial.status}>
            <option value="draft">Draft (only admins see it)</option>
            <option value="published">Published</option>
          </select>
        </div>
      </div>
      <div className="form-row">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" maxLength={150} defaultValue={initial.title} required />
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
              <input id={`ml-${m.key}`} name="material_label" type="text" maxLength={150} defaultValue={m.label} />
            </div>
            <div className="form-row">
              <label htmlFor={`mu-${m.key}`}>Material link</label>
              <input id={`mu-${m.key}`} name="material_url" type="url" defaultValue={m.url} placeholder="https://…" />
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
              <input id={`ht-${h.key}`} name="hw_title" type="text" maxLength={150} defaultValue={h.title} />
            </div>
            <div className="form-row">
              <label htmlFor={`hi-${h.key}`}>Instructions</label>
              <textarea id={`hi-${h.key}`} name="hw_instructions" rows={4} defaultValue={h.instructions} />
            </div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div className="form-row" style={{ flex: "1 1 12rem" }}>
                <label htmlFor={`hd-${h.key}`}>Deadline (Pakistan time)</label>
                <input id={`hd-${h.key}`} name="hw_deadline" type="datetime-local" defaultValue={h.deadline} />
                <span className="hint">Leave empty for no deadline.</span>
              </div>
              <div className="form-row" style={{ flex: "1 1 12rem" }}>
                <label htmlFor={`hh-${h.key}`}>Hand-in link expected?</label>
                <select id={`hh-${h.key}`} name="hw_handin" defaultValue={h.handin ? "yes" : "no"}>
                  <option value="no">No: students just mark it done</option>
                  <option value="yes">Yes: students hand in a link</option>
                </select>
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
        <SubmitButton pendingText="Saving…">Save class</SubmitButton>
        <Link className="btn-quiet" href="/admin/classes">Cancel</Link>
      </div>
    </form>
  );
}
