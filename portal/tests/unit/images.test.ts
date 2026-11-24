import { describe, expect, it } from "vitest";
import { droppedImages, isImagePath, MAX_IMAGES, parseImageList } from "@/lib/images";

const me = "11111111-2222-3333-4444-555555555555";
const other = "99999999-8888-7777-6666-555555555555";
const pic = (owner = me, n = 1, ext = "webp") => `${owner}/aaaaaaaa-bbbb-cccc-dddd-00000000000${n}.${ext}`;

describe("picture paths", () => {
  it("accepts <user>/<id>.<webp|jpg|png> and checks the owner when asked", () => {
    expect(isImagePath(pic())).toBe(true);
    expect(isImagePath(pic(me, 1, "jpg"), me)).toBe(true);
    expect(isImagePath(pic(other), me)).toBe(false);
    expect(isImagePath(pic(me, 1, "gif"))).toBe(false);
    expect(isImagePath(`${me}/../secret.png`)).toBe(false);
    expect(isImagePath("https://evil.example/x.png")).toBe(false);
  });
});

describe("picture lists from forms", () => {
  it("reads paths or { path, url } objects, and drops duplicates", () => {
    expect(parseImageList("")).toEqual({ value: [] });
    expect(parseImageList(JSON.stringify([pic(), { path: pic(me, 2), url: "https://x" }, pic()]))).toEqual({ value: [pic(), pic(me, 2)] });
  });
  it(`refuses more than ${MAX_IMAGES}, someone else's pictures, and junk`, () => {
    const five = [1, 2, 3, 4, 5].map((n) => pic(me, n));
    expect(parseImageList(JSON.stringify(five))).toHaveProperty("error");
    expect(parseImageList(JSON.stringify([pic(other)]), me)).toHaveProperty("error");
    expect(parseImageList("not json")).toHaveProperty("error");
    expect(parseImageList(JSON.stringify({ path: pic() }))).toHaveProperty("error");
  });
  it("finds the pictures an edit removed", () => {
    expect(droppedImages([pic(me, 1), pic(me, 2)], [pic(me, 2), pic(me, 3)])).toEqual([pic(me, 1)]);
  });
});
