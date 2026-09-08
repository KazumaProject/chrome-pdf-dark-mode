export const PDF_RANGE_CHUNK_SIZE = 2 ** 16;

export async function createLocalPdfRangeTransport(pdfjsLib, file, rangeChunkSize = PDF_RANGE_CHUNK_SIZE) {
  const initialLength = Math.min(rangeChunkSize, file.size);
  const initialData = new Uint8Array(await file.slice(0, initialLength).arrayBuffer());
  const RangeTransport = pdfjsLib.PDFDataRangeTransport;

  return new (class extends RangeTransport {
    constructor() {
      super(file.size, initialData, initialData.byteLength === file.size, file.name);
      this.aborted = false;
    }

    requestDataRange(begin, end) {
      if (this.aborted) return;

      void file.slice(begin, end).arrayBuffer().then((buffer) => {
        if (!this.aborted) this.onDataRange(begin, new Uint8Array(buffer));
      }).catch(() => {
        if (!this.aborted) this.abort();
      });
    }

    abort() {
      this.aborted = true;
    }
  })();
}
