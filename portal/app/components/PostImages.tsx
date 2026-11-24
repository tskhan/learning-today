import { signedImageUrls } from "@/lib/images-server";

/** A message's or class guide's pictures, under its text. Tapping one opens it full size. */
export async function PostImages({ paths, label = "Picture" }: { paths: string[]; label?: string }) {
  if (!paths?.length) return null;
  const urls = await signedImageUrls(paths);
  const shown = paths.map((p) => urls.get(p)).filter((u): u is string => Boolean(u));
  if (shown.length === 0) return null;
  return (
    <div className={`post-images count-${shown.length}`}>
      {shown.map((url, i) => (
        <a key={url} href={url} target="_blank" rel="noopener" aria-label={`Open ${label.toLowerCase()} ${i + 1} full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links from Supabase Storage */}
          <img src={url} alt={`${label} ${i + 1}`} loading="lazy" />
        </a>
      ))}
    </div>
  );
}
