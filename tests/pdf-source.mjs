import assert from "node:assert/strict";
import { createLocalPdfRangeTransport, PDF_RANGE_CHUNK_SIZE } from "../pdf-source.js";

const bytes = new Uint8Array(PDF_RANGE_CHUNK_SIZE + 32);
bytes.forEach((_value, index) => {
  bytes[index] = index % 251;
});

const reads = [];
const listeners = [];
const pendingReads = new Map();
const file = {
  name: "range-fixture.pdf",
  size: bytes.byteLength,
  slice(begin, end) {
    reads.push([begin, end]);
    return {
      arrayBuffer: () => {
        if (begin === 0) return Promise.resolve(bytes.slice(begin, end).buffer);
        return new Promise((resolve) => pendingReads.set(begin, () => resolve(bytes.slice(begin, end).buffer)));
      }
    };
  }
};

class FakeRangeTransport {
  constructor(length, initialData, progressiveDone, filename) {
    this.length = length;
    this.initialData = initialData;
    this.progressiveDone = progressiveDone;
    this.contentDispositionFilename = filename;
  }

  transportReady(listener) {
    this.listener = listener;
  }

  onDataRange(begin, chunk) {
    this.listener({ type: "range", begin, chunk });
  }
}

const transport = await createLocalPdfRangeTransport(
  { PDFDataRangeTransport: FakeRangeTransport },
  file
);

assert.deepEqual(reads, [[0, PDF_RANGE_CHUNK_SIZE]]);
assert.equal(transport.length, file.size);
assert.equal(transport.initialData.byteLength, PDF_RANGE_CHUNK_SIZE);
assert.equal(transport.progressiveDone, false);
assert.equal(transport.contentDispositionFilename, file.name);

transport.transportReady((event) => listeners.push(event));
transport.requestDataRange(123, 456);
pendingReads.get(123)();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(reads, [[0, PDF_RANGE_CHUNK_SIZE], [123, 456]]);
assert.equal(listeners.length, 1);
assert.equal(listeners[0].begin, 123);
assert.deepEqual(Array.from(listeners[0].chunk), Array.from(bytes.slice(123, 456)));

transport.abort();
transport.requestDataRange(789, 900);
assert.deepEqual(reads, [[0, PDF_RANGE_CHUNK_SIZE], [123, 456]]);

console.log("pdf-source: passed");
