import assert from "node:assert/strict";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from "../vendor/pdf-lib.mjs";
import {
  ANNOTATION_MARKER_PREFIX,
  annotationRecordFromPdfData,
  exportAnnotatedPdf,
  getAnnotationMarker
} from "../pdf-annotations.js";
import {
  formatPageRange,
  getAnnotationBounds,
  parsePageRange,
  pdfPointToViewport,
  scaleAnnotationGeometry,
  textContentToPlainText,
  viewportPointToPdf
} from "../viewer-utils.js";

assert.deepEqual(parsePageRange("1, 4-6, 6, 2", 8), {
  pages: [1, 2, 4, 5, 6],
  error: ""
});
assert.deepEqual(parsePageRange(" 2 - 4 ", 8).pages, [2, 3, 4]);
assert.match(parsePageRange("3-1", 8).error, /ascending/);
assert.match(parsePageRange("1,9", 8).error, /between 1 and 8/);
assert.match(parsePageRange("1,,2", 8).error, /Invalid/);
assert.equal(formatPageRange([6, 1, 2, 2, 4, 5]), "1-2,4-6");

const line = { kind: "line", start: [20, 80], end: [120, 180] };
assert.deepEqual(getAnnotationBounds(line), [20, 80, 120, 180]);
assert.deepEqual(getAnnotationBounds({ kind: "rectangle", bounds: [90, 50, 10, 140] }), [10, 50, 90, 140]);
assert.deepEqual(getAnnotationBounds({ kind: "text", bounds: [90, 50, 10, 140] }), [10, 50, 90, 140]);
const scaled = scaleAnnotationGeometry(line, [20, 80, 120, 180], [0, 0, 200, 300]);
assert.deepEqual(scaled.start, [0, 0]);
assert.deepEqual(scaled.end, [200, 300]);

const pageSize = { width: 600, height: 800 };
for (const rotation of [0, 90, 180, 270]) {
  const point = [137, 421];
  const viewport = pdfPointToViewport(point, pageSize, 1.5, rotation);
  assert.deepEqual(viewportPointToPdf(viewport, pageSize, 1.5, rotation), point);
}

assert.equal(textContentToPlainText({ items: [
  { str: "Hello" }, { str: "world", hasEOL: true }, { str: "Next" }
] }), "Hello world\nNext");

const sourceDocument = await PDFDocument.create();
sourceDocument.addPage([600, 800]);
sourceDocument.addPage([400, 300]);
const sourceBytes = await sourceDocument.save({ useObjectStreams: false });
const annotations = [
  { id: "pen-1", pageNumber: 1, kind: "pen", color: "#ff0000", thickness: 3, paths: [[[20, 30], [80, 90]], [[100, 110], [140, 150]]] },
  { id: "line-1", pageNumber: 1, kind: "line", color: "#00ff00", thickness: 2, start: [100, 200], end: [300, 120] },
  { id: "arrow-1", pageNumber: 1, kind: "arrow", color: "#0000ff", thickness: 4, start: [320, 220], end: [120, 500] },
  { id: "rect-1", pageNumber: 1, kind: "rectangle", color: "#ff00ff", thickness: 2, bounds: [20, 520, 200, 720] },
  { id: "text-1", pageNumber: 1, kind: "text", color: "#111111", thickness: 2, fontSize: 18, text: "Editable note", bounds: [230, 540, 350, 558] },
  { id: "ellipse-1", pageNumber: 2, kind: "ellipse", color: "#00ffff", thickness: 5, bounds: [50, 50, 250, 250] }
];
const editedBytes = await exportAnnotatedPdf({ sourceBytes, annotations });
assert.deepEqual(sourceBytes, await sourceDocument.save({ useObjectStreams: false }));

function resolve(context, value) {
  return value instanceof PDFRef ? context.lookup(value) : value;
}

function pageAnnotationDicts(document, pageIndex) {
  const context = document.context;
  const raw = document.getPage(pageIndex).node.get(PDFName.of("Annots"));
  const array = resolve(context, raw);
  if (!(array instanceof PDFArray)) return [];
  return Array.from({ length: array.size() }, (_value, index) => resolve(context, array.get(index)))
    .filter((dict) => dict instanceof PDFDict);
}

const reopened = await PDFDocument.load(editedBytes);
assert.equal(reopened.getPageCount(), 2);
assert.deepEqual(pageAnnotationDicts(reopened, 0).map((dict) => dict.get(PDFName.of("Subtype")).toString()), [
  "/Ink", "/Line", "/Line", "/Square", "/FreeText"
]);
assert.equal(pageAnnotationDicts(reopened, 1)[0].get(PDFName.of("Subtype")).toString(), "/Circle");
const arrowDict = pageAnnotationDicts(reopened, 0)[2];
assert.equal(resolve(reopened.context, arrowDict.get(PDFName.of("LE"))).get(1).toString(), "/OpenArrow");
assert.match(resolve(reopened.context, arrowDict.get(PDFName.of("T"))).decodeText(), /^Dark PDF Viewer\|arrow-1\|arrow\|/);
const penInkList = resolve(reopened.context, pageAnnotationDicts(reopened, 0)[0].get(PDFName.of("InkList")));
assert.equal(penInkList.size(), 2);

const selectedBytes = await exportAnnotatedPdf({
  sourceBytes,
  selectedPageNumbers: [2],
  annotations
});
const selectedDocument = await PDFDocument.load(selectedBytes);
assert.equal(selectedDocument.getPageCount(), 1);
assert.equal(selectedDocument.getPage(0).getWidth(), 400);
assert.equal(pageAnnotationDicts(selectedDocument, 0).length, 1);
assert.equal(pageAnnotationDicts(selectedDocument, 0)[0].get(PDFName.of("Subtype")).toString(), "/Circle");

const deletedBytes = await exportAnnotatedPdf({
  sourceBytes: editedBytes,
  annotations: [{
    id: "pen-1",
    pageNumber: 1,
    kind: "pen",
    sourceMarker: getAnnotationMarker(annotations[0]),
    deleted: true
  }]
});
assert.equal(pageAnnotationDicts(await PDFDocument.load(deletedBytes), 0).length, 4);

const arrowTitle = resolve(reopened.context, arrowDict.get(PDFName.of("T"))).decodeText();
const parsedArrow = annotationRecordFromPdfData({
  subtype: "Line",
  titleObj: { str: arrowTitle },
  rect: [100, 200, 330, 530],
  lineCoordinates: [100, 200, 330, 530],
  lineEndings: ["None", "OpenArrow"],
  borderStyle: { width: 4 },
  color: [0, 0, 255]
}, 1);
assert.equal(parsedArrow.id, "arrow-1");
assert.deepEqual(parsedArrow.start, [320, 220]);
assert.deepEqual(parsedArrow.end, [120, 500]);
const textDict = pageAnnotationDicts(reopened, 0)[4];
const textTitle = resolve(reopened.context, textDict.get(PDFName.of("T"))).decodeText();
const parsedText = annotationRecordFromPdfData({
  subtype: "FreeText",
  titleObj: { str: textTitle },
  rect: [230, 540, 350, 558],
  contents: "Editable note",
  color: [17, 17, 17]
}, 1);
assert.equal(parsedText.id, "text-1");
assert.equal(parsedText.text, "Editable note");
assert.equal(parsedText.fontSize, 18);
const legacyPenTitle = `${ANNOTATION_MARKER_PREFIX}|legacy-pen|pen|${encodeURIComponent(JSON.stringify({
  color: "#ff0000",
  thickness: 3,
  paths: [[20, 30], [80, 90]]
}))}`;
const parsedLegacyPen = annotationRecordFromPdfData({
  subtype: "Ink",
  titleObj: { str: legacyPenTitle },
  inkLists: [[20, 30, 80, 90]],
  rect: [20, 30, 80, 90]
}, 1);
assert.deepEqual(parsedLegacyPen.paths, [[[20, 30], [80, 90]]]);
assert.equal(ANNOTATION_MARKER_PREFIX, "Dark PDF Viewer");

console.log("pdf-annotations: passed");
