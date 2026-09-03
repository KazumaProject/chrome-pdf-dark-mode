import assert from "node:assert/strict";
import {
  buildDuotoneMatrix,
  getAnchoredScrollPosition,
  getCurrentPageNumber,
  getKeyboardCommand,
  getPageAnchor,
  getWheelZoomDirection,
  normalizeHexColor,
  normalizePageNumber
} from "../viewer-utils.js";

assert.equal(getKeyboardCommand({ key: "+", ctrlKey: true }), "zoom-in");
assert.equal(getKeyboardCommand({ key: "=", ctrlKey: true }), "zoom-in");
assert.equal(getKeyboardCommand({ key: "-", ctrlKey: true }), "zoom-out");
assert.equal(getKeyboardCommand({ key: "0", ctrlKey: true }), "fit");
assert.equal(getKeyboardCommand({ key: "o", ctrlKey: true }), "open");
assert.equal(getKeyboardCommand({ key: "+", ctrlKey: false }), "");
assert.equal(getWheelZoomDirection({ ctrlKey: true, deltaY: -100 }), 1);
assert.equal(getWheelZoomDirection({ ctrlKey: true, deltaY: 100 }), -1);
assert.equal(getWheelZoomDirection({ ctrlKey: false, deltaY: -100 }), 0);

assert.equal(normalizePageNumber("7", 10, 3), 7);
assert.equal(normalizePageNumber("0", 10, 3), 1);
assert.equal(normalizePageNumber("99", 10, 3), 10);
assert.equal(normalizePageNumber("", 10, 3), 3);
assert.equal(normalizePageNumber("not-a-page", 10, 3), 3);
assert.equal(normalizePageNumber("-2", 10, 3), 1);

const currentPage = getCurrentPageNumber([
  { top: 20, height: 800 },
  { top: 842, height: 800 },
  { top: 1664, height: 800 }
], {
  scrollTop: 1000,
  height: 600
});
assert.equal(currentPage, 2);
assert.equal(getCurrentPageNumber([
  { top: 0, height: 400 },
  { top: 420, height: 400 }
], { scrollTop: 380, height: 40 }), 1);
assert.equal(getCurrentPageNumber([], { scrollTop: 0, height: 600 }), null);

const pageAnchor = getPageAnchor([
  { top: 20, left: 100, width: 600, height: 800 },
  { top: 842, left: 100, width: 600, height: 800 },
  { top: 1664, left: 100, width: 600, height: 800 }
], {
  scrollTop: 1000,
  scrollLeft: 0,
  width: 800,
  height: 600
});
assert.equal(pageAnchor.pageNumber, 2);
assert.equal(pageAnchor.relativeY, 0.5725);

const anchoredScroll = getAnchoredScrollPosition(pageAnchor, {
  top: 1664,
  left: 50,
  width: 1200,
  height: 1600
});
assert.deepEqual(anchoredScroll, { top: 2280, left: 250 });

assert.equal(normalizeHexColor("#ABCDEF", "#000000"), "#abcdef");
assert.equal(normalizeHexColor("bad", "#123456"), "#123456");

const matrix = buildDuotoneMatrix("#f1f3f4", "#202124");
function applyMatrix(red, green, blue) {
  const input = [red / 255, green / 255, blue / 255, 1, 1];
  return [0, 1, 2].map((row) => {
    const offset = row * 5;
    return Math.round(255 * matrix.slice(offset, offset + 5)
      .reduce((sum, coefficient, index) => sum + coefficient * input[index], 0));
  });
}
assert.deepEqual(applyMatrix(0, 0, 0), [241, 243, 244]);
assert.deepEqual(applyMatrix(255, 255, 255), [32, 33, 36]);

console.log("viewer-utils: passed");
