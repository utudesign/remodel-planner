import { describe, expect, it } from "vitest";
import { exifDateTime } from "@/lib/exif";

/** Builds a minimal JPEG with an APP1 Exif block holding DateTimeOriginal (big-endian TIFF). */
function jpegWithDate(date: string, littleEndian = false): ArrayBuffer {
  const tiff: number[] = [];
  const w16 = (n: number) => (littleEndian ? tiff.push(n & 255, n >> 8) : tiff.push(n >> 8, n & 255));
  const w32 = (n: number) =>
    littleEndian ? tiff.push(n & 255, (n >> 8) & 255, (n >> 16) & 255, n >>> 24) : tiff.push(n >>> 24, (n >> 16) & 255, (n >> 8) & 255, n & 255);
  tiff.push(...(littleEndian ? [0x49, 0x49] : [0x4d, 0x4d]));
  w16(42);
  w32(8); // IFD0 at 8
  // IFD0: 1 entry (ExifIFD pointer) → exif IFD at 26
  w16(1);
  w16(0x8769); w16(4); w32(1); w32(26);
  w32(0);
  // Exif IFD at 26: 1 entry DateTimeOriginal (ASCII, 20 bytes at 44)
  w16(1);
  w16(0x9003); w16(2); w32(20); w32(44);
  w32(0);
  for (const c of date) tiff.push(c.charCodeAt(0));
  tiff.push(0);
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xd9];
  return new Uint8Array(bytes).buffer;
}

describe("exifDateTime", () => {
  it("reads DateTimeOriginal (big- and little-endian)", () => {
    expect(exifDateTime(jpegWithDate("2026:10:22 18:42:05"))).toBe("2026-10-22T18:42:05");
    expect(exifDateTime(jpegWithDate("2026:10:22 18:42:05", true))).toBe("2026-10-22T18:42:05");
  });
  it("returns null for non-JPEG or no EXIF", () => {
    expect(exifDateTime(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(exifDateTime(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer)).toBeNull();
  });
});
