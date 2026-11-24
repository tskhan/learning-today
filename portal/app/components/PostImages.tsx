import { signedImageUrls } from "@/lib/images-server";
import { ImageGallery } from "./ImageGallery";

/** A message's or class guide's pictures, under its text. Clicking one opens it large in the page. */
export async function PostImages({ paths, label = "Picture" }: { paths: string[]; label?: string }) {
  if (!paths?.length) return null;
  const urls = await signedImageUrls(paths);
  const shown = paths.map((p) => urls.get(p)).filter((u): u is string => Boolean(u));
  if (shown.length === 0) return null;
  return <ImageGallery urls={shown} label={label} />;
}
