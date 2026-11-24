"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extension-placeholder";
import { discardImage, uploadImage } from "@/app/actions/images";
import { MAX_IMAGES, type AttachedImage } from "@/lib/images";
import { shrinkImage } from "@/lib/shrink-image";
import { useModal } from "./Modal";

/**
 * A message box: formatting as you type (bold, italic, underline, lists, links…) and up to four
 * pictures, pasted, dropped or picked. The text is saved as Markdown in a hidden field (`name`),
 * the pictures as a JSON list in another (`imagesName`); the server checks and cleans both.
 */
export function Composer({
  id,
  label,
  name,
  imagesName,
  initialMarkdown = "",
  initialImages = [],
  headings = false,
  placeholder,
  hint,
  minHeight = "7rem",
}: {
  id: string;
  label: string;
  name: string;
  /** Leave out to turn pictures off. */
  imagesName?: string;
  initialMarkdown?: string;
  initialImages?: AttachedImage[];
  headings?: boolean;
  placeholder?: string;
  hint?: string;
  minHeight?: string;
}) {
  const labelId = `${id}-label`;
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [images, setImages] = useState<AttachedImage[]>(initialImages);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  // Pictures uploaded in this box and not yet sent: removing one deletes its file straight away.
  const fresh = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  // Latest values for the paste/drop handlers and the submit guard, which outlive a render.
  const imagesRef = useRef(images);
  const uploadingRef = useRef(uploading);

  async function addFiles(files: File[]) {
    setProblem(null);
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    if (pictures.length === 0) return;
    const room = MAX_IMAGES - imagesRef.current.length - uploadingRef.current;
    if (room <= 0) {
      setProblem(`You can add up to ${MAX_IMAGES} pictures.`);
      return;
    }
    const batch = pictures.slice(0, room);
    if (pictures.length > room) setProblem(`Only ${MAX_IMAGES} pictures fit, so ${pictures.length - room} ${pictures.length - room === 1 ? "was" : "were"} left out.`);
    setUploading((n) => n + batch.length);
    for (const file of batch) {
      try {
        let small: File;
        try {
          small = await shrinkImage(file);
        } catch {
          setProblem("That picture type can't be used here. Try a screenshot, a JPG or a PNG.");
          continue;
        }
        const fd = new FormData();
        fd.set("file", small);
        const result = await uploadImage(fd);
        if ("error" in result) {
          setProblem(result.error);
          continue;
        }
        fresh.current.add(result.path);
        setImages((list) => [...list, result]);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }
  const addFilesRef = useRef(addFiles);
  useLayoutEffect(() => {
    imagesRef.current = images;
    uploadingRef.current = uploading;
    addFilesRef.current = addFiles;
  });

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: headings ? { levels: [2, 3] } : false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialMarkdown,
    contentType: "markdown",
    editorProps: {
      attributes: {
        id,
        class: "rich-content prose",
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        style: `min-height: ${minHeight}`,
      },
      handlePaste: (_view, event) => {
        if (!imagesName) return false;
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        void addFilesRef.current(files);
        return true;
      },
      handleDrop: (_view, event) => {
        if (!imagesName) return false;
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        void addFilesRef.current(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => setMarkdown(e.isEmpty ? "" : e.getMarkdown()),
  });

  // Don't let the form send while pictures are still uploading (they'd be missing from the message).
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    if (!form) return;
    const stop = (e: Event) => {
      if (uploadingRef.current > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setProblem("Wait a moment: the pictures are still uploading.");
      }
    };
    form.addEventListener("submit", stop, { capture: true });
    return () => form.removeEventListener("submit", stop, { capture: true });
  }, []);

  function removeImage(path: string) {
    setImages((list) => list.filter((img) => img.path !== path));
    if (fresh.current.has(path)) {
      fresh.current.delete(path);
      void discardImage(path);
    }
  }

  return (
    <div className="form-row composer" ref={wrapper}>
      <label id={labelId} onClick={() => editor?.commands.focus()}>{label}</label>
      <div className="composer-box">
        <Toolbar editor={editor} headings={headings} />
        <EditorContent editor={editor} />
        {!editor ? <div className="rich-content prose" style={{ minHeight }} aria-hidden="true" /> : null}
      </div>
      <input type="hidden" name={name} value={markdown} />
      {imagesName ? (
        <>
          <input type="hidden" name={imagesName} value={JSON.stringify(images)} />
          {images.length > 0 || uploading > 0 ? (
            <ul className="attachments" aria-label="Pictures">
              {images.map((img, i) => (
                <li key={img.path}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
                  <img src={img.url} alt={`Picture ${i + 1}`} />
                  <button type="button" className="remove" aria-label={`Remove picture ${i + 1}`} onClick={() => removeImage(img.path)}>×</button>
                </li>
              ))}
              {Array.from({ length: uploading }, (_, i) => (
                <li key={`up-${i}`} className="uploading" aria-label="Uploading picture"><span>Uploading…</span></li>
              ))}
            </ul>
          ) : null}
          <div className="row composer-actions">
            <button
              type="button"
              className="link-button"
              disabled={images.length + uploading >= MAX_IMAGES}
              onClick={() => fileInput.current?.click()}
            >
              📎 Add pictures
            </button>
            <span className="hint">
              {images.length + uploading >= MAX_IMAGES ? `${MAX_IMAGES} of ${MAX_IMAGES} pictures.` : "Or paste (Ctrl+V) or drop pictures in the box."}
            </span>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/*"
              multiple
              id={`${id}-files`}
              aria-label="Choose picture files"
              tabIndex={-1}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void addFiles(files);
              }}
            />
          </div>
        </>
      ) : null}
      {problem ? <p className="error" role="alert" style={{ marginBlockEnd: 0 }}>{problem}</p> : null}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

function Toolbar({ editor, headings }: { editor: Editor | null; headings: boolean }) {
  const button = (label: string, text: React.ReactNode, active: boolean, run: () => void) => (
    <button
      type="button"
      className={`tool${active ? " on" : ""}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={!editor}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {text}
    </button>
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const chain = () => editor!.chain().focus();
  const is = (name: string, attrs?: Record<string, unknown>) => Boolean(editor?.isActive(name, attrs));
  return (
    <div className="toolbar" role="toolbar" aria-label="Formatting">
      {button("Bold", <b>B</b>, is("bold"), () => chain().toggleBold().run())}
      {button("Italic", <i>I</i>, is("italic"), () => chain().toggleItalic().run())}
      {button("Underline", <u>U</u>, is("underline"), () => chain().toggleUnderline().run())}
      {button("Strikethrough", <s>S</s>, is("strike"), () => chain().toggleStrike().run())}
      <span className="sep" aria-hidden="true" />
      {headings ? button("Heading", "H", is("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run()) : null}
      {button("Bulleted list", "•", is("bulletList"), () => chain().toggleBulletList().run())}
      {button("Numbered list", "1.", is("orderedList"), () => chain().toggleOrderedList().run())}
      {button("Quote", "❝", is("blockquote"), () => chain().toggleBlockquote().run())}
      {button("Code", "</>", is("code"), () => chain().toggleCode().run())}
      {button("Link", "🔗", is("link"), () => {
        setLinkValue((editor?.getAttributes("link").href as string | undefined) ?? "");
        setLinkOpen(true);
      })}
      <LinkDialog
        open={linkOpen}
        value={linkValue}
        hasLink={is("link")}
        onChange={setLinkValue}
        onCancel={() => setLinkOpen(false)}
        onRemove={() => {
          setLinkOpen(false);
          chain().extendMarkRange("link").unsetLink().run();
        }}
        onSave={() => {
          setLinkOpen(false);
          const href = linkValue.trim();
          if (!href) {
            chain().extendMarkRange("link").unsetLink().run();
            return;
          }
          const url = /^(https?:\/\/|mailto:)/i.test(href) ? href : `https://${href}`;
          chain().extendMarkRange("link").setLink({ href: url }).run();
        }}
      />
    </div>
  );
}

/** The Link button's box: the address to link the selected text to. */
function LinkDialog({ open, value, hasLink, onChange, onCancel, onRemove, onSave }: {
  open: boolean;
  value: string;
  hasLink: boolean;
  onChange: (v: string) => void;
  onCancel: () => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useModal(ref, open, onCancel);
  const titleId = useId();
  const inputId = useId();
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} {...({ closedby: "any" } as object)}>
      {open ? (
        <>
          <h1 id={titleId}>{hasLink ? "Edit link" : "Add a link"}</h1>
          <div className="form-row">
            <label htmlFor={inputId}>Link address</label>
            <input
              id={inputId}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={value}
              autoFocus
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                // This box sits inside the message form: Enter saves the link, not the message.
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSave();
                }
              }}
            />
            <span className="hint">Select some text first to turn it into a link.</span>
          </div>
          <div className="modal-actions">
            {hasLink ? <button type="button" className="link-button danger" onClick={onRemove}>Remove link</button> : null}
            <button type="button" className="btn-quiet" onClick={onCancel}>Cancel</button>
            <button type="button" className="btn" onClick={onSave}>{hasLink ? "Save link" : "Add link"}</button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
