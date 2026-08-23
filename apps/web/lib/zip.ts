/**
 * A zip archive, written by hand. ADR-067.
 *
 * STORED, never deflated. The contents are markdown, SVG and already-compressed
 * JPEG and Opus, so deflate would spend CPU to save single-digit percentages on
 * the text and nothing at all on the rest.
 *
 * Hand-written because apps/web has no archive dependency and this is a hundred
 * lines of a format from 1989 that has not moved since. Adding a package to the
 * one app that ships to a browser, for something the server does in a route
 * handler, is the worse trade.
 */

export type ZipEntry = { name: string; bytes: Uint8Array };

const LOCAL = 0x04034b50;
const CENTRAL = 0x02014b50;
const END = 0x06054b50;
/** Bit 11: the names below are UTF-8. Without it, an accented title arrives
 *  mangled on Windows, which is where most people will open this. */
const UTF8 = 0x0800;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, packed into one little-endian word each. Two-second
 *  resolution, and 1980 is the epoch. Neither of those is a bug. */
function dosStamp(d: Date): number {
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  return (((date << 16) >>> 0) | time) >>> 0;
}

export function zip(entries: ZipEntry[], at = new Date()): Uint8Array {
  const stamp = dosStamp(at);
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const sum = crc32(entry.bytes);
    const size = entry.bytes.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, UTF8, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(10, stamp, true);
    lv.setUint32(14, sum, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, CENTRAL, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, UTF8, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(12, stamp, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    parts.push(local, entry.bytes);
    directory.push(central);
    offset += local.length + size;
  }

  const directorySize = directory.reduce((n, part) => n + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, END, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  return concat([...parts, ...directory, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
