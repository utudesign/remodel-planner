/**
 * Reads the capture time (EXIF DateTimeOriginal, else DateTime) from a JPEG, without a library.
 * Returns the camera's local wall-clock time as "YYYY-MM-DDTHH:mm:ss" (EXIF has no time zone),
 * or null. GPS is never read; re-encoding the photo on the phone drops all EXIF anyway.
 */
export function exifDateTime(buf: ArrayBuffer): string | null {
  try {
    return scan(new DataView(buf));
  } catch {
    return null; // truncated or odd files: no capture time
  }
}

function scan(v: DataView): string | null {
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null; // not a JPEG
  let off = 2;
  while (off + 4 <= v.byteLength) {
    const marker = v.getUint16(off);
    const len = v.getUint16(off + 2);
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return readTiff(v, off + 10); // "Exif"
    if ((marker & 0xff00) !== 0xff00 || len < 2) return null;
    off += 2 + len;
  }
  return null;
}

function readTiff(v: DataView, tiff: number): string | null {
  if (tiff + 8 > v.byteLength) return null;
  const little = v.getUint16(tiff) === 0x4949;
  const u16 = (o: number) => v.getUint16(o, little);
  const u32 = (o: number) => v.getUint32(o, little);
  const ascii = (o: number, n: number) => {
    let s = "";
    for (let i = 0; i < n && o + i < v.byteLength; i++) {
      const c = v.getUint8(o + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const entries = (ifd: number) => {
    const out = new Map<number, { type: number; count: number; valueOff: number }>();
    if (ifd + 2 > v.byteLength) return out;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > v.byteLength) break;
      out.set(u16(e), { type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 });
    }
    return out;
  };
  const str = (e: { count: number; valueOff: number } | undefined) =>
    e ? ascii(e.count > 4 ? tiff + u32(e.valueOff) : e.valueOff, e.count) : null;

  const ifd0 = entries(tiff + u32(tiff + 4));
  const exifPtr = ifd0.get(0x8769);
  let raw: string | null = null;
  if (exifPtr) raw = str(entries(tiff + u32(exifPtr.valueOff)).get(0x9003)); // DateTimeOriginal
  raw = raw || str(ifd0.get(0x0132)); // DateTime
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
}
