import { excerpt } from "@/lib/markdown";
import { formatDate, formatDateTime } from "@/lib/time";

export interface ClassForEmail {
  number: number;
  title: string;
  classDate: string;
  summaryMd: string;
  homework: Array<{ title: string; deadline: string | null }>;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * The "new class guide" email: subject, a plain-text version and a simple HTML version. Kept
 * small and plain so it reads well in Gmail on a phone and doesn't look like marketing.
 */
export function buildClassEmail(cls: ClassForEmail, siteUrl: string): { subject: string; text: string; html: string } {
  const link = `${siteUrl}/classes/${cls.number}`;
  const profile = `${siteUrl}/profile#emails`;
  const subject = `Class ${cls.number} guide is up: ${cls.title}`;
  const summary = excerpt(cls.summaryMd, 300);
  const homework = cls.homework.map((h) => ({
    title: h.title,
    due: h.deadline ? `due ${formatDateTime(h.deadline)} Pakistan time` : "no deadline",
  }));

  const text = [
    `Class ${cls.number} · ${formatDate(cls.classDate)}`,
    cls.title,
    "",
    summary || null,
    summary ? "" : null,
    homework.length ? "Homework:" : null,
    ...homework.map((h) => `- ${h.title} (${h.due})`),
    homework.length ? "" : null,
    `Read the guide: ${link}`,
    "",
    "You're getting this because you're a member of the Batch 91 Portal.",
    `To stop these emails, turn them off in your profile: ${profile}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px 12px;background:#ededed;font-family:Arial,Helvetica,sans-serif;color:#222222;">
<div style="max-width:560px;margin:0 auto;background:#f6f6f6;border:1px solid #cfcfcf;border-radius:8px;padding:24px;">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#b35500;font-weight:bold;">Class ${cls.number} · ${escape(formatDate(cls.classDate))}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;">${escape(cls.title)}</h1>
${summary ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#444444;">${escape(summary)}</p>` : ""}
${homework.length ? `<p style="margin:0 0 6px;font-size:14px;font-weight:bold;">Homework</p><ul style="margin:0 0 16px;padding-left:20px;font-size:14px;line-height:1.5;">${homework.map((h) => `<li>${escape(h.title)} <span style="color:#626262;">(${escape(h.due)})</span></li>`).join("")}</ul>` : ""}
<p style="margin:20px 0 0;"><a href="${escape(link)}" style="display:inline-block;background:#c45f00;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;letter-spacing:1px;text-transform:uppercase;padding:12px 20px;border-radius:2px;">Read the guide</a></p>
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#626262;text-align:center;">You're getting this because you're a member of the Batch 91 Portal.<br><a href="${escape(profile)}" style="color:#626262;">Turn these emails off in your profile</a>.</p>
</body></html>`;

  return { subject, text, html };
}
