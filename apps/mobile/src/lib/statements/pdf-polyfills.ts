/**
 * The few built-ins pdfjs reaches for that Hermes may not have. unpdf's build
 * already fills in Promise.withResolvers, Math.sumPrecise, DOMMatrix and
 * FinalizationRegistry; these cover the rest pdfjs can touch while reading text.
 * Each is installed only when missing.
 */

// pdfjs clones every message to its in-process worker with
// `structuredClone(msg, transfer ? { transfer } : null)`. Expo's structuredClone
// (@ungap) destructures its options and throws on null, which leaves the
// document promise pending forever, so pass undefined instead.
const clone = globalThis.structuredClone;
if (typeof clone === "function") {
  globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions | null) =>
    clone(value, options ?? undefined)) as typeof structuredClone;
}

type WithTransfer = ArrayBuffer & { transferToFixedLength?: (length?: number) => ArrayBuffer };

// Font info is packed into a buffer and trimmed with this before crossing to the "main thread".
if (!(ArrayBuffer.prototype as WithTransfer).transferToFixedLength) {
  Object.defineProperty(ArrayBuffer.prototype, "transferToFixedLength", {
    configurable: true,
    writable: true,
    value(this: ArrayBuffer, length = this.byteLength): ArrayBuffer {
      const out = new ArrayBuffer(length);
      new Uint8Array(out).set(new Uint8Array(this, 0, Math.min(length, this.byteLength)));
      return out;
    },
  });
}

type SetWithIntersection<T> = Set<T> & { intersection?: (other: Set<T>) => Set<T> };

// Named destinations; cheap to have, and a missing method would throw mid-document.
if (!(Set.prototype as SetWithIntersection<unknown>).intersection) {
  Object.defineProperty(Set.prototype, "intersection", {
    configurable: true,
    writable: true,
    value<T>(this: Set<T>, other: Set<T>): Set<T> {
      const out = new Set<T>();
      for (const v of this) if (other.has(v)) out.add(v);
      return out;
    },
  });
}
