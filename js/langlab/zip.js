// Largest file the language mirror will read from an archive, after decompression.
export const MAX_ENTRY_BYTES = 50e6;
// A small reader for .zip files that uses the browser's own decompression
// (DecompressionStream), so no library is needed. It reads only the entries asked for.
// Not supported: encrypted archives and archives over 4 GB (zip64). In those cases, or in a
// browser without DecompressionStream, the caller asks the person to extract the files first.

export function zipSupported() {
  return typeof DecompressionStream === 'function' && typeof Blob === 'function';
}

async function bytesOf(blob, start, end) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

// blob: a File or Blob. Returns [{ name, size, read(): Promise<Uint8Array> }].
export async function readZip(blob) {
  if (!zipSupported()) throw new Error('unsupported');
  const size = blob.size;
  const tailLen = Math.min(size, 65557);
  const tail = await bytesOf(blob, size - tailLen, size);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 0x05 && tail[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('notzip');
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const count = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) throw new Error('zip64');
  const cd = await bytesOf(blob, cdOffset, cdOffset + cdSize);
  const v = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const td = new TextDecoder();
  const entries = [];
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.length; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = td.decode(cd.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    entries.push({
      name,
      size: usize,
      async read() {
        if (flags & 1) throw new Error('encrypted');
        if (csize === 0xffffffff || local === 0xffffffff) throw new Error('zip64');
        const lh = await bytesOf(blob, local, local + 30);
        const lv = new DataView(lh.buffer);
        if (lv.getUint32(0, true) !== 0x04034b50) throw new Error('notzip');
        const start = local + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
        const data = blob.slice(start, start + csize);
        if (method === 0) {
          if (csize > MAX_ENTRY_BYTES) throw new Error('toolarge');
          return new Uint8Array(await data.arrayBuffer());
        }
        if (method !== 8) throw new Error('method');
        // count real bytes while inflating: the size a zip declares cannot be trusted (zip bombs)
        const reader = data.stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        const parts = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > MAX_ENTRY_BYTES) {
            reader.cancel().catch(() => {});
            throw new Error('toolarge');
          }
          parts.push(value);
        }
        const out = new Uint8Array(total);
        let at = 0;
        for (const part of parts) {
          out.set(part, at);
          at += part.length;
        }
        return out;
      },
    });
  }
  return entries;
}
