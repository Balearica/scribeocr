// File summary:
// Main file that defines all interface event listners, defines all global variables,
// and contains key functions for importing data and rendering to pdf/canvas.
//
// TODO: This file contains many miscellaneous functions and would benefit from being refactored.
// Additionally, various data stored as global variables

window.d = function () {
  debugger;
}

import { renderText } from './js/exportRenderText.js';
import { renderHOCR } from './js/exportRenderHOCR.js';

import { renderPage } from './js/renderPage.js';

import { getFontSize, calcWordWidth, calcWordMetrics } from "./js/textUtils.js"

import { optimizeFont, calculateOverallFontMetrics, createSmallCapsFont } from "./js/fontOptimize.js";
import { loadFont, loadFontFamily } from "./js/fontUtils.js";

import { getRandomAlphanum, quantile, sleep, readOcrFile, round3, rotateBoundingBox } from "./js/miscUtils.js";

import {
  deleteSelectedWords, toggleStyleSelectedWords, changeWordFontSize, toggleBoundingBoxesSelectedWords, changeWordFont, toggleSuperSelectedWords,
  updateHOCRWord, adjustBaseline, adjustBaselineRange, adjustBaselineRangeChange, updateHOCRBoundingBoxWord
} from "./js/interfaceEdit.js";

import { initMuPDFWorker } from "./mupdf/mupdf-async.js";


// Third party libraries
import { simd } from "./lib/wasm-feature-detect.js";
import Tesseract from './tess/tesseract.es6.js';


// Opt-in to bootstrap tooltip feature
// https://getbootstrap.com/docs/5.0/components/tooltips/
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl);
})



// Global variables containing fonts represented as OpenType.js objects and array buffers (respectively)
var leftGlobal;


// Disable objectCaching (significant improvement to render time)
fabric.Object.prototype.objectCaching = false;
// Disable movement for all fabric objects
fabric.Object.prototype.hasControls = false;
fabric.Object.prototype.lockMovementX = true;
fabric.Object.prototype.lockMovementY = true;

fabric.IText.prototype.toObject = (function (toObject) {
  return function () {
    return fabric.util.object.extend(toObject.call(this), {
      fill_proof: this.fill_proof,
      fill_ebook: this.fill_ebook,
      wordID: this.wordID,
      boxWidth: this.boxWidth,
      defaultFontFamily: this.defaultFontFamily
    });
  };
})(fabric.IText.prototype.toObject);

// Displaying bounding boxes is useful for cases where text is correct but word segmentation is wrong
// https://stackoverflow.com/questions/51233082/draw-border-on-fabric-textbox-when-its-not-selected
var originalRender = fabric.Textbox.prototype._render;
fabric.IText.prototype._render = function (ctx) {
  originalRender.call(this, ctx);
  //Don't draw border if it is active(selected/ editing mode)
  //if (this.selected) return;
  if (this.showTextBoxBorder) {
    var w = this.width,
      h = this.height,
      x = -this.width / 2,
      y = -this.height / 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y);
    ctx.closePath();
    var stroke = ctx.strokeStyle;
    ctx.strokeStyle = this.textboxBorderColor;
    ctx.stroke();
    ctx.strokeStyle = stroke;
  }
}


// Object that keeps track of what type of input data is present
globalThis.inputDataModes = {
  // true if OCR data exists (whether from upload or built-in engine)
  xmlMode: undefined,
  // true if user uploaded pdf
  pdfMode: false,
  // true if user uploaded image files (.png, .jpeg)
  imageMode: false,
  // true if user re-uploaded HOCR data created by Scribe OCR
  resumeMode: false
}

// Object that keeps track of various global settings
globalThis.globalSettings = {
  simdSupport: false,
  defaultFont: "Libre Baskerville"
}

// Object for data currently being displayed on the canvas
globalThis.currentPage = {
  n: 0,
  backgroundImage: null,
  backgroundOpts: {},
  leftAdjX: 0,
  renderStatus: 0,
  xmlDoc: null
}


var parser = new DOMParser();

// Define canvas
globalThis.canvas = new fabric.Canvas('c');
globalThis.ctx = canvas.getContext('2d');

// Disable viewport transformations for overlay images (this prevents margin lines from moving with page)
canvas.overlayVpt = false;

// Turn off (some) automatic rendering of canvas
canvas.renderOnAddRemove = false;

// Content that should be run once, after all dependencies are done loading are done loading
globalThis.runOnLoad = function () {

  // Load fonts
  loadFontFamily("Open Sans", globalThis.fontMetricsObj);
  loadFontFamily("Libre Baskerville", globalThis.fontMetricsObj);

  // Detect whether SIMD instructions are supported
  simd().then(async function (x) {
    globalSettings.simdSupport = x;
    // Show error message if SIMD support is not present
    if (x) {
      document.getElementById("debugEngineVersion").innerText = "Enabled";
    } else {
      document.getElementById("simdWarning").setAttribute("style", "");
      document.getElementById("debugEngineVersion").innerText = "Disabled";
    }
  });

}



const pageNumElem = /** @type {HTMLInputElement} */(document.getElementById('pageNum'))

//const upload = document.getElementById('uploader');

globalThis.bsCollapse = new bootstrap.Collapse(document.getElementById("collapseRange"), { toggle: false });

// Add various event listners to HTML elements
document.getElementById('next').addEventListener('click', onNextPage);
document.getElementById('prev').addEventListener('click', onPrevPage);

const uploaderElem = /** @type {HTMLInputElement} */(document.getElementById('uploader'));
uploaderElem.addEventListener('change', importFiles);

const colorModeElem = /** @type {HTMLInputElement} */(document.getElementById('colorMode'));
colorModeElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });

const createGroundTruthElem = /** @type {HTMLInputElement} */(document.getElementById('createGroundTruth'));
createGroundTruthElem.addEventListener('click', createGroundTruthClick);

const enableEvalElem = /** @type {HTMLInputElement} */(document.getElementById('enableEval'));

// If evaluate option is enabled, show tab and widen navbar to fit everything on the same row
enableEvalElem.addEventListener('click', () => {
  if (enableEvalElem.checked) {
    document.getElementById("nav-tab-container").setAttribute("class", "col-8 col-xl-7");
    document.getElementById("nav-eval-tab").setAttribute("style", "");
  } else {
    document.getElementById("nav-tab-container").setAttribute("class", "col-8 col-xl-6");
    document.getElementById("nav-eval-tab").setAttribute("style", "display:none");
  }

});


const uploadOCRNameElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRName'));
const uploadOCRFileElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRFile'));

const uploadOCRButtonElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRButton'));
uploadOCRButtonElem.addEventListener('click', importOCRFiles);

const uploadOCRLabelElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRLabel'));
const uploadOCRDataElem = /** @type {HTMLInputElement} */(document.getElementById('uploadOCRData'));

uploadOCRDataElem.addEventListener('show.bs.collapse', function () {
  if (!uploadOCRNameElem.value) {
    uploadOCRNameElem.value = "OCR Data " + (displayLabelOptionsElem.childElementCount + 1);
  }
})


document.getElementById('fontMinus').addEventListener('click', () => { changeWordFontSize('minus') });
document.getElementById('fontPlus').addEventListener('click', () => { changeWordFontSize('plus') });
const fontSizeElem = /** @type {HTMLInputElement} */(document.getElementById('fontSize'));
fontSizeElem.addEventListener('change', (event) => { changeWordFontSize(fontSizeElem.value) });
const wordFontElem = /** @type {HTMLInputElement} */(document.getElementById('wordFont'));
wordFontElem.addEventListener('change', (event) => { changeWordFont(wordFontElem.value) });


document.getElementById('styleItalic').addEventListener('click', () => { toggleStyleSelectedWords('italic') });
document.getElementById('styleSmallCaps').addEventListener('click', () => { toggleStyleSelectedWords('small-caps') });
document.getElementById('styleSuper').addEventListener('click', toggleSuperSelectedWords);

document.getElementById('editBoundingBox').addEventListener('click', toggleBoundingBoxesSelectedWords);
document.getElementById('editBaseline').addEventListener('click', adjustBaseline);

const rangeBaselineElem = /** @type {HTMLInputElement} */(document.getElementById('rangeBaseline'));
rangeBaselineElem.addEventListener('input', (event) => { adjustBaselineRange(rangeBaselineElem.value) });
rangeBaselineElem.addEventListener('mouseup', (event) => { adjustBaselineRangeChange(rangeBaselineElem.value) });

document.getElementById('deleteWord').addEventListener('click', deleteSelectedWords);

document.getElementById('addWord').addEventListener('click', addWordClick);
document.getElementById('reset').addEventListener('click', clearFiles);

document.getElementById('zoomMinus').addEventListener('click', () => { changeZoom('minus') });
const zoomInputElem = /** @type {HTMLInputElement} */(document.getElementById('zoomInput'));
zoomInputElem.addEventListener('change', (event) => { changeZoom(zoomInputElem.value) });
document.getElementById('zoomPlus').addEventListener('click', () => { changeZoom('plus') });

const displayFontElem = /** @type {HTMLInputElement} */(document.getElementById('displayFont'));
displayFontElem.addEventListener('change', (event) => { changeDisplayFont(displayFontElem.value) });

// const previewBinaryElem = /** @type {HTMLInputElement} */(document.getElementById('previewBinary'));
// previewBinaryElem.addEventListener('click', previewBinaryImage);

const optimizeFontElem = /** @type {HTMLInputElement} */(document.getElementById('optimizeFont'));
optimizeFontElem.addEventListener('click', (event) => { optimizeFontClick(optimizeFontElem.checked) });

const confThreshHighElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshHigh'));
const confThreshMedElem = /** @type {HTMLInputElement} */(document.getElementById('confThreshMed'));
confThreshHighElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });
confThreshMedElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', false) });


// const binaryCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('binaryCheckbox'));

const autoRotateCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoRotateCheckbox'));
const autoMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('autoMarginCheckbox'));
const showMarginCheckboxElem = /** @type {HTMLInputElement} */(document.getElementById('showMarginCheckbox'));
autoRotateCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
autoMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
showMarginCheckboxElem.addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });
document.getElementById('showBoundingBoxes').addEventListener('click', () => { renderPageQueue(currentPage.n, 'screen', false) });

const rangeLeftMarginElem = /** @type {HTMLInputElement} */(document.getElementById('rangeLeftMargin'));
rangeLeftMarginElem.addEventListener('input', () => { adjustMarginRange(rangeLeftMarginElem.value) });
rangeLeftMarginElem.addEventListener('mouseup', () => { adjustMarginRangeChange(rangeLeftMarginElem.value) });

const displayLabelOptionsElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelOptions'));
const displayLabelTextElem = /** @type {HTMLInputElement} */(document.getElementById('displayLabelText'));
displayLabelOptionsElem.addEventListener('click', (e) => { if (e.target.className != "dropdown-item") return; setCurrentHOCR(e.target.innerHTML) });



const downloadElem = /** @type {HTMLInputElement} */(document.getElementById('download'));
downloadElem.addEventListener('click', handleDownload);
document.getElementById('pdfPagesLabel').addEventListener('click', updatePdfPagesLabel);

document.getElementById('formatLabelOptionPDF').addEventListener('click', () => { setFormatLabel("pdf") });
document.getElementById('formatLabelOptionHOCR').addEventListener('click', () => { setFormatLabel("hocr") });
document.getElementById('formatLabelOptionText').addEventListener('click', () => { setFormatLabel("text") });

document.getElementById('oemLabelOptionLstm').addEventListener('click', () => { setOemLabel("lstm") });
document.getElementById('oemLabelOptionLegacy').addEventListener('click', () => { setOemLabel("legacy") });

document.getElementById('psmLabelOption3').addEventListener('click', () => { setPsmLabel("3") });
document.getElementById('psmLabelOption4').addEventListener('click', () => { setPsmLabel("4") });

const recognizeAllElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeAll'));
recognizeAllElem.addEventListener('click', recognizeAll);
const recognizePageElem = /** @type {HTMLInputElement} */(document.getElementById('recognizePage'));
recognizePageElem.addEventListener('click', recognizePage);

const recognizeAreaElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeArea'));
recognizeAreaElem.addEventListener('click', () => recognizeAreaClick(false));
const recognizeWordElem = /** @type {HTMLInputElement} */(document.getElementById('recognizeWord'));
recognizeWordElem.addEventListener('click', () => recognizeAreaClick(true));

function displayModeClick(x) {

  if (x == "eval") {
    renderPageQueue(currentPage.n, 'screen', true);
  } else {
    selectDisplayMode(displayModeElem.value);
  }

}


const ignorePunctElem = /** @type {HTMLInputElement} */(document.getElementById("ignorePunct"));
ignorePunctElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });

const ignoreCapElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreCap"));
ignoreCapElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });

const ignoreExtraElem = /** @type {HTMLInputElement} */(document.getElementById("ignoreExtra"));
ignoreExtraElem.addEventListener('change', () => { renderPageQueue(currentPage.n, 'screen', true) });


const displayModeElem = /** @type {HTMLInputElement} */(document.getElementById('displayMode'));
displayModeElem.addEventListener('change', () => { displayModeClick(displayModeElem.value) });

const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
pdfPageMinElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
pdfPageMaxElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    updatePdfPagesLabel();
  }
});

const pageCountElem = /** @type {HTMLInputElement} */(document.getElementById('pageCount'));
const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));

pageNumElem.addEventListener('keyup', function (event) {
  if (event.keyCode === 13) {
    const nMax = parseInt(pageCountElem.textContent);
    const pageNum = parseInt(pageNumElem.value);
    if (pageNum <= nMax && pageNum > 0) {
      currentPage.n = pageNum - 1;
      rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
      canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
      renderPageQueue(currentPage.n);

      // Render 1 page ahead and behind
      if (inputDataModes.pdfMode && cacheMode) {
        let cacheArr = [...Array(cachePages).keys()].map(i => i + currentPage.n + 1).filter(x => x < nMax && x >= 0);
        if (cacheArr.length > 0) {
          renderPDFImageCache(cacheArr);
        }
        cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + currentPage.n - 1).filter(x => x < nMax && x >= 0);
        if (cacheArr.length > 0) {
          renderPDFImageCache(cacheArr);
        }

      }
    } else {
      pageNumElem.value = (currentPage.n + 1).toString();
    }
  }
});


function updatePdfPagesLabel() {

  let minValue = parseInt(pdfPageMinElem.value) || null;
  let maxValue = parseInt(pdfPageMaxElem.value) || null;
  let pageCount = parseInt(pageCountElem.textContent) || null;

  minValue = Math.max(minValue, 1);
  maxValue = Math.min(maxValue, pageCount);

  let pagesStr;
  if (minValue > 0 && maxValue > 0 && (minValue > 1 || maxValue < pageCount)) {
    pagesStr = " Pages: " + minValue + "–" + maxValue;
  } else {
    pagesStr = " Pages: All";
    minValue = 1;
    maxValue = pageCount;
  }

  pdfPageMinElem.value = minValue ? minValue.toString() : "1";
  pdfPageMaxElem.value = maxValue ? maxValue.toString() : "";
  document.getElementById('pdfPagesLabelText').innerText = pagesStr;

}


function setFormatLabel(x) {
  if (x.toLowerCase() == "pdf") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
  <path d="M4.603 14.087a.81.81 0 0 1-.438-.42c-.195-.388-.13-.776.08-1.102.198-.307.526-.568.897-.787a7.68 7.68 0 0 1 1.482-.645 19.697 19.697 0 0 0 1.062-2.227 7.269 7.269 0 0 1-.43-1.295c-.086-.4-.119-.796-.046-1.136.075-.354.274-.672.65-.823.192-.077.4-.12.602-.077a.7.7 0 0 1 .477.365c.088.164.12.356.127.538.007.188-.012.396-.047.614-.084.51-.27 1.134-.52 1.794a10.954 10.954 0 0 0 .98 1.686 5.753 5.753 0 0 1 1.334.05c.364.066.734.195.96.465.12.144.193.32.2.518.007.192-.047.382-.138.563a1.04 1.04 0 0 1-.354.416.856.856 0 0 1-.51.138c-.331-.014-.654-.196-.933-.417a5.712 5.712 0 0 1-.911-.95 11.651 11.651 0 0 0-1.997.406 11.307 11.307 0 0 1-1.02 1.51c-.292.35-.609.656-.927.787a.793.793 0 0 1-.58.029zm1.379-1.901c-.166.076-.32.156-.459.238-.328.194-.541.383-.647.547-.094.145-.096.25-.04.361.01.022.02.036.026.044a.266.266 0 0 0 .035-.012c.137-.056.355-.235.635-.572a8.18 8.18 0 0 0 .45-.606zm1.64-1.33a12.71 12.71 0 0 1 1.01-.193 11.744 11.744 0 0 1-.51-.858 20.801 20.801 0 0 1-.5 1.05zm2.446.45c.15.163.296.3.435.41.24.19.407.253.498.256a.107.107 0 0 0 .07-.015.307.307 0 0 0 .094-.125.436.436 0 0 0 .059-.2.095.095 0 0 0-.026-.063c-.052-.062-.2-.152-.518-.209a3.876 3.876 0 0 0-.612-.053zM8.078 7.8a6.7 6.7 0 0 0 .2-.828c.031-.188.043-.343.038-.465a.613.613 0 0 0-.032-.198.517.517 0 0 0-.145.04c-.087.035-.158.106-.196.283-.04.192-.03.469.046.822.024.111.054.227.09.346z"/>`

    document.getElementById("formatLabelText").innerHTML = "PDF";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".pdf";
  } else if (x.toLowerCase() == "hocr") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2v-1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5L14 4.5ZM3.527 11.85h-.893l-.823 1.439h-.036L.943 11.85H.012l1.227 1.983L0 15.85h.861l.853-1.415h.035l.85 1.415h.908l-1.254-1.992 1.274-2.007Zm.954 3.999v-2.66h.038l.952 2.159h.516l.946-2.16h.038v2.661h.715V11.85h-.8l-1.14 2.596h-.025L4.58 11.85h-.806v3.999h.706Zm4.71-.674h1.696v.674H8.4V11.85h.791v3.325Z"/>`

    document.getElementById("formatLabelText").innerHTML = "HOCR";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".hocr";
  } else if (x.toLowerCase() == "text") {
    document.getElementById("formatLabelSVG").innerHTML = String.raw`  <path d="M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5z"/>
  <path d="M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5z"/>`

    document.getElementById("formatLabelText").innerHTML = "Text";
    downloadFileNameElem.value = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".txt";

  }
}

function setOemLabel(x) {
  if (x.toLowerCase() == "lstm") {
    document.getElementById("oemLabelText").innerHTML = "LSTM";
  } else if (x.toLowerCase() == "legacy") {
    document.getElementById("oemLabelText").innerHTML = "Legacy";
  }
}

function setPsmLabel(x) {
  if (x == "3") {
    document.getElementById("psmLabelText").innerHTML = "Automatic";
  } else if (x == "4") {
    document.getElementById("psmLabelText").innerHTML = "Single Column";
  } else if (x == "8") {
    document.getElementById("psmLabelText").innerHTML = "Single Word";
  }
}



function addDisplayLabel(x) {
  // Exit early if option already exists
  const existingOptions = displayLabelOptionsElem.children;
  for (let i = 0; i < existingOptions.length; i++){
    if (existingOptions[i].innerHTML == x) return;
  }
  let option = document.createElement("a");
  option.setAttribute("class", "dropdown-item");
  option.text = x;
  displayLabelOptionsElem.appendChild(option);
}

window.hocrAll = new Object;
function setCurrentHOCR(x) {
  const currentLabel = displayLabelText.innerHTML.trim();
  if (!x.trim() || x == currentLabel) return;

  globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  if (currentLabel) {
    window.hocrAll[currentLabel] = window.hocrCurrent;
  }
  if (!window.hocrAll[x]) {
    window.hocrAll[x] = Array(imageAll.length);
  }
  window.hocrCurrent = window.hocrAll[x];
  displayLabelText.innerHTML = x;
  currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[currentPage.n], "text/xml");

  if (displayModeElem.value == "eval") {
    renderPageQueue(currentPage.n, 'screen', true);
  } else {
    renderPageQueue(currentPage.n, 'screen', false);
  }

}




async function changeDisplayFont(font) {
  if (!currentPage.xmlDoc) return;
  globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  const optimizeMode = optimizeFontElem.checked;
  if (typeof (fontObj[font]) != "undefined" && typeof (fontObj[font]["normal"]) != "undefined" && fontObj[font]["normal"].optimized == optimizeMode) {
    globalSettings.defaultFont = font;
    renderPageQueue(currentPage.n, 'screen', false);
  } else {
    console.log("Loading new font");
    await loadFontFamily(font, window.fontMetricsObj);
    globalSettings.defaultFont = font;
    if (optimizeMode) {
      await optimizeFont2();
    }
    renderPageQueue(currentPage.n, 'screen', false);
  }

}


function changeZoom(value) {
  if (currentPage.xmlDoc) {
    window.hocrCurrent[currentPage.n] = currentPage.xmlDoc.documentElement.outerHTML;
  }

  let currentValue = parseFloat(zoomInputElem.value);

  if (value == "minus") {
    value = currentValue - 50;
  } else if (value == "plus") {
    value = currentValue + 50;
  }

  // Set min/max values to avoid typos causing unexpected issues
  value = Math.max(value, 300);
  value = Math.min(value, 5000);

  zoomInputElem.value = value;
  renderPageQueue(currentPage.n, "screen", false);
}


function adjustMarginRange(value) {
  window.canvas.viewportTransform[4] = (parseInt(value) - 200);
  window.canvas.renderAll();
}


function adjustMarginRangeChange(value) {
  if (typeof (window.pageMetricsObj["manAdjAll"]) == "undefined") return;
  window.pageMetricsObj["manAdjAll"][currentPage.n] = (parseInt(value) - 200);
}

// Users may select an edit action (e.g. "Add Word", "Recognize Word", etc.) but then never follow through.
// This function cleans up any changes/event listners caused by the initial click in such cases.
document.getElementById('navBar').addEventListener('click', function (e) {
  newWordInit = true;
  canvas.__eventListeners = {};
}, true)


// Various operations display loading bars, which are removed from the screen when both:
// (1) the user closes the tab and (2) the loading bar is full.
document.getElementById('nav-import').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-import") return;
  hideProgress("import-progress-collapse");
})

document.getElementById('nav-recognize').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-recognize") return;
  hideProgress("import-eval-progress-collapse");
  // hideProgress("render-recognize-progress-collapse");
  hideProgress("recognize-recognize-progress-collapse");
})

document.getElementById('nav-download').addEventListener('hidden.bs.collapse', function (e) {
  if (e.target.id != "nav-download") return;
  // hideProgress("render-download-progress-collapse");
  // hideProgress("binary-download-progress-collapse");
  hideProgress("generate-download-progress-collapse");
})




// When the navbar is "sticky", it does not automatically widen for large canvases (when the canvas size is larger than the viewport).
// However, when the navbar is fixed, the canvas does not move out of the way of the navbar.
// Therefore, the navbar is set to fixed, and the canvas is manually moved up/down when tabs are shown/collapsed.
var tabHeightObj = { "nav-import": 66, "nav-recognize": 102, "nav-eval": 89, "nav-view": 117, "nav-edit": 104, "nav-layout": 88, "nav-download": 104, "nav-about": 55 }

const paddingRowElem = document.getElementById('paddingRow');

function adjustPaddingRow(e) {
  if (e.target.id != this.id) return;
  let currentHeight = parseInt(paddingRowElem.style.height.slice(0, -2));
  if (e.type == "hide.bs.collapse") {
    paddingRowElem.style.height = currentHeight - tabHeightObj[e.target.id] + "px";
  } else if (e.type == "show.bs.collapse") {
    paddingRowElem.style.height = currentHeight + tabHeightObj[e.target.id] + "px";
  }
}

for (const [key, value] of Object.entries(tabHeightObj)) {
  document.getElementById(key).addEventListener('show.bs.collapse', adjustPaddingRow);
  document.getElementById(key).addEventListener('hide.bs.collapse', adjustPaddingRow);
}


function toggleEditButtons(disable = true) {
  let editButtons = ["styleItalic", "styleSmallCaps", "styleSuper", "editBoundingBox", "editBaseline", "deleteWord", "addWord"];
  for (let i = 0; i < editButtons.length; i++) {
    const editButtonElem = /** @type {HTMLInputElement} */(document.getElementById(editButtons[i]));
    editButtonElem.disabled = disable;
  }
}

function initializeProgress(id, maxValue, initValue = 0) {
  const progressCollapse = document.getElementById(id);

  const progressCollapseObj = new bootstrap.Collapse(progressCollapse, { toggle: false });

  const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];

  progressBar.setAttribute("aria-valuenow", initValue.toString());
  progressBar.setAttribute("style", "width: " + ((initValue / maxValue) * 100) + "%");
  progressBar.setAttribute("aria-valuemax", maxValue);
  progressCollapseObj.show()

  return (progressBar);

}

// Hides progress bar if completed
function hideProgress(id) {
  const progressCollapse = document.getElementById(id);
  if (progressCollapse.getAttribute("class") == "collapse show") {
    const progressBar = progressCollapse.getElementsByClassName("progress-bar")[0];
    if (parseInt(progressBar.getAttribute("aria-valuenow")) == parseInt(progressBar.getAttribute("aria-valuemax"))) {
      progressCollapse.setAttribute("class", "collapse");
    }
  }
}


async function createTesseractScheduler(workerN, config = null) {

  const allConfig = config || getTesseractConfigs();

  let workerOptions;
  if (globalSettings.simdSupport) {
    console.log("Using Tesseract with SIMD support (fast LSTM performance).")
    workerOptions = { corePath: 'https://scribeocr.com/tess/tesseract-core-sse.wasm.js', workerPath: 'https://scribeocr.com/tess/worker.min.js' };
  } else {
    console.log("Using Tesseract without SIMD support (slow LSTM performance).")
    workerOptions = { corePath: 'https://scribeocr.com/tess/tesseract-core.wasm.js', workerPath: 'https://scribeocr.com/tess/worker.min.js' };
  }

  const scheduler = Tesseract.createScheduler();

  for (let i = 0; i < workerN; i++) {
    const w = Tesseract.createWorker(workerOptions);
    await w.load();
    await w.loadLanguage('eng');
    await w.initialize('eng', allConfig.tessedit_ocr_engine_mode);
    await w.setParameters(allConfig);

    scheduler.addWorker(w);
  }

  // Add config object to scheduler.
  // This does not do anything directly, but allows for easily checking what options were used at a later point.
  scheduler["config"] = allConfig;

  return (scheduler);

}

function getTesseractConfigs() {
  // Get current settings as specified by user
  const oemConfig = document.getElementById("oemLabelText").innerHTML == "Legacy" ? Tesseract.OEM['TESSERACT_ONLY'] : Tesseract.OEM['LSTM_ONLY'];
  const psmConfig = document.getElementById("psmLabelText").innerHTML == "Single Column" ? Tesseract.PSM["SINGLE_COLUMN"] : Tesseract.PSM['AUTO'];

  const allConfig = {
    tessedit_ocr_engine_mode: oemConfig,
    tessedit_pageseg_mode: psmConfig,
    hocr_char_boxes: '1',
    // The Tesseract LSTM engine frequently identifies a bar character "|"
    // This is virtually always a false positive (usually "I").
    tessedit_char_blacklist: "|"
  };

  return (allConfig);
}

// Checks scheduler to see if user has changed settings since scheduler was created
function checkTesseractScheduler(scheduler, config = null) {
  if (!scheduler?.["config"]) return false;
  const allConfig = config || getTesseractConfigs();
  delete scheduler?.["config"].rectangle;

  if (JSON.stringify(scheduler.config) === JSON.stringify(allConfig)) return true;
  return false;

}

async function recognizePage() {

  const allConfig = getTesseractConfigs();

  // Do not use character-level data.
  // The character-level data is not used for font kerning metrics, as at present only 1 font is optimized,
  // and the text Tesseract misses using "Recognize All" is generally not from the body text (usually page numbers).
  allConfig.hocr_char_boxes = '0';

  // Create new scheduler if one does not exist, or the existing scheduler was created using different settings
  if (!checkTesseractScheduler(recognizeAreaScheduler, allConfig)) {
    if (recognizeAreaScheduler) {
      await recognizeAreaScheduler.terminate()
      recognizeAreaScheduler = null;
    }
    recognizeAreaScheduler = await createTesseractScheduler(1, allConfig);
  }

  const inputImage = await window.imageAll[currentPage.n];

  recognizeAreaScheduler.addJob('recognize', inputImage.src, allConfig).then((y) => {
    const image = document.createElement('img');
    image.src = y.data.image;
    window.imageAllBinary[currentPage.n] = image;
    window.hocrCurrentRaw[currentPage.n] = y.data.hocr;
    //convertPageWorker.postMessage([y.data.hocr, currentPage.n, false, true, undefined, pageMetricsObj["angleAll"][currentPage.n]]);
    convertPage([y.data.hocr, currentPage.n, false, true, undefined, pageMetricsObj["angleAll"][currentPage.n]])
  })

  // Enable confidence threshold input boxes (only used for Tesseract)
  confThreshHighElem.disabled = false;
  confThreshMedElem.disabled = false;

  // Set threshold values if not already set
  confThreshHighElem.value = confThreshHighElem.value || "85";
  confThreshMedElem.value = confThreshMedElem.value || "75";

  toggleEditButtons(false);

}



function createGroundTruthClick() {
  // Use whatever the current HOCR is as a starting point
  window.hocrAll["Ground Truth"] = structuredClone(window.hocrCurrent);
  addDisplayLabel("Ground Truth");
  setCurrentHOCR("Ground Truth");

  let option = document.createElement("option");
  option.text = "Evaluate Mode (Compare with Ground Truth)";
  option.value = "eval";
  displayModeElem.add(option);

  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = false;
}

window.evalStatsConfig = {};

window.evalStats = new Array();
function compareGroundTruthClick(n) {

  // When a document/recognition is still loading only the page statistics can be calculated
  const loadMode = loadCountHOCR && loadCountHOCR < parseInt(convertPageWorker["activeProgress"]?.getAttribute("aria-valuemax")) ? true : false;

  const evalStatsConfigNew = {};
  evalStatsConfigNew["ocrActive"] = displayLabelTextElem.innerHTML;
  evalStatsConfigNew["ignorePunct"] = document.getElementById("ignorePunct").checked;
  evalStatsConfigNew["ignoreCap"] = document.getElementById("ignoreCap").checked;
  evalStatsConfigNew["ignoreExtra"] = document.getElementById("ignoreExtra").checked;

  // Compare all pages if this has not been done already
  if (!loadMode && JSON.stringify(window.evalStatsConfig) != JSON.stringify(evalStatsConfigNew) || window.evalStats.length == 0) {
    window.evalStats = new Array(imageAll.length);
    for (let i = 0; i < imageAll.length; i++){
      const res = compareHOCR(globalThis.hocrCurrent[i], window.hocrAll["Ground Truth"][i]);
      window.evalStats[i] = res[1];
    }
    window.evalStatsConfig = evalStatsConfigNew;
  }

  const res = compareHOCR(globalThis.hocrCurrent[n], window.hocrAll["Ground Truth"][n]);

  globalThis.hocrCurrent[n] = res[0].documentElement.outerHTML;
  window.evalStats[n] = res[1];

  // Display metrics for current page
  document.getElementById("metricTotalWordsPage").innerHTML = window.evalStats[n][0];
  document.getElementById("metricCorrectWordsPage").innerHTML = window.evalStats[n][1];
  document.getElementById("metricIncorrectWordsPage").innerHTML = window.evalStats[n][2];
  document.getElementById("metricMissedWordsPage").innerHTML = window.evalStats[n][3];
  document.getElementById("metricExtraWordsPage").innerHTML = window.evalStats[n][4];

  if (evalStatsConfigNew["ignoreExtra"]) {
    document.getElementById("metricWERPage").innerHTML = Math.round(((window.evalStats[n][2] + window.evalStats[n][3]) / window.evalStats[n][0]) * 100) / 100;
  } else {
    document.getElementById("metricWERPage").innerHTML = Math.round(((window.evalStats[n][2] + window.evalStats[n][3] + window.evalStats[n][4]) / window.evalStats[n][0]) * 100) / 100;
  }

  // Calculate and display metrics for full document
  if (!loadMode) {
    let evalStatsDoc = [0, 0, 0, 0, 0]
    for (let i = 0; i < window.evalStats.length; i++) {
      evalStatsDoc[0] = evalStatsDoc[0] + window.evalStats[i][0];
      evalStatsDoc[1] = evalStatsDoc[1] + window.evalStats[i][1];
      evalStatsDoc[2] = evalStatsDoc[2] + window.evalStats[i][2];
      evalStatsDoc[3] = evalStatsDoc[3] + window.evalStats[i][3];
      evalStatsDoc[4] = evalStatsDoc[4] + window.evalStats[i][4];
    }

    document.getElementById("metricTotalWordsDoc").innerHTML = evalStatsDoc[0];
    document.getElementById("metricCorrectWordsDoc").innerHTML = evalStatsDoc[1];
    document.getElementById("metricIncorrectWordsDoc").innerHTML = evalStatsDoc[2];
    document.getElementById("metricMissedWordsDoc").innerHTML = evalStatsDoc[3];
    document.getElementById("metricExtraWordsDoc").innerHTML = evalStatsDoc[4];

    if (evalStatsConfigNew["ignoreExtra"]) {
      document.getElementById("metricWERDoc").innerHTML = Math.round(((evalStatsDoc[2] + evalStatsDoc[3]) / evalStatsDoc[0]) * 100) / 100;
    } else {
      document.getElementById("metricWERDoc").innerHTML = Math.round(((evalStatsDoc[2] + evalStatsDoc[3] + evalStatsDoc[4]) / evalStatsDoc[0]) * 100) / 100;
    }
  } else {
    document.getElementById("metricTotalWordsDoc").innerHTML = '';
    document.getElementById("metricCorrectWordsDoc").innerHTML = '';
    document.getElementById("metricIncorrectWordsDoc").innerHTML = '';
    document.getElementById("metricMissedWordsDoc").innerHTML = '';
    document.getElementById("metricExtraWordsDoc").innerHTML = '';
    document.getElementById("metricWERDoc").innerHTML = '';
  }

  currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[n], "text/xml");

  // if (inputDataModes.xmlMode[n]) {
  //   globalThis.hocrCurrent[n] = currentPage.xmlDoc.documentElement.outerHTML;
  // }

}


function compareHOCR(hocrStrA, hocrStrB) {

  hocrStrA = hocrStrA.replace(/compCount=['"]\d+['"]/g, "");
  hocrStrA = hocrStrA.replace(/compStatus=['"]\d+['"]/g, "");

  hocrStrB = hocrStrB.replace(/compCount=['"]\d+['"]/g, "");
  hocrStrB = hocrStrB.replace(/compStatus=['"]\d+['"]/g, "");

  const hocrA = parser.parseFromString(hocrStrA, "text/xml");
  const hocrB = parser.parseFromString(hocrStrB, "text/xml");

  const hocrALines = hocrA.getElementsByClassName("ocr_line");
  const hocrBLines = hocrB.getElementsByClassName("ocr_line");

  window.hocrAOverlap = {};
  window.hocrBOverlap = {};
  window.hocrBCorrect = {};

  //let minLineB = 0;
  for (let i = 0; i < hocrALines.length; i++){
    const hocrALine = hocrALines[i];
    const titleStrLineA = hocrALine.getAttribute('title');
    const lineBoxA = [...titleStrLineA.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

    //for (let j = minLineB; j < hocrBLines.length; j++){
    for (let j = 0; j < hocrBLines.length; j++) {
      const hocrBLine = hocrBLines[j];
      const titleStrLineB = hocrBLine.getAttribute('title');
      const lineBoxB = [...titleStrLineB.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

      // If top of line A is below bottom of line B, move to next line B
      if (lineBoxA[1] > lineBoxB[3]) {
        //minLineB = minLineB + 1;
        continue;

      // If top of line B is below bottom of line A, move to next line A
      // (We assume no match is possible for any B)
      } else if (lineBoxB[1] > lineBoxA[3]) {
        //break;
        continue;

      // Otherwise, there is possible overlap
      } else {
        let minWordB = 0;
        const hocrAWords = hocrALine.getElementsByClassName("ocrx_word");
        const hocrBWords = hocrBLine.getElementsByClassName("ocrx_word");

        for (let k = 0; k < hocrAWords.length; k++){
          const hocrAWord = hocrAWords[k];
          const hocrAWordID = hocrAWord.getAttribute("id");

          // If option is set to ignore punctuation and the current "word" conly contains punctuation,
          // exit early with options that will result in the word being printed in green.
          if (ignorePunctElem.checked && !hocrAWord.textContent.replace(/[\W_]/g, "")) {
            hocrAWord.setAttribute("compCount", "1");
            hocrAWord.setAttribute("compStatus", "1");
          }


          //if (j == minLineB) hocrAWord.setAttribute("compCount", "0");
          hocrAWord.setAttribute("compCount", hocrAWord.getAttribute("compCount") || "0");

          const titleStrWordA = hocrAWord.getAttribute('title');
          const wordBoxA = [...titleStrWordA.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

          // Remove 10% from all sides of bounding box
          // This prevents small overlapping (around the edges) from triggering a comparison
          const wordBoxAWidth = wordBoxA[2] - wordBoxA[0];
          const wordBoxAHeight = wordBoxA[3] - wordBoxA[1];

          wordBoxA[0] = wordBoxA[0] + Math.round(wordBoxAWidth * 0.1);
          wordBoxA[2] = wordBoxA[2] - Math.round(wordBoxAWidth * 0.1);

          wordBoxA[1] = wordBoxA[1] + Math.round(wordBoxAHeight * 0.1);
          wordBoxA[3] = wordBoxA[3] - Math.round(wordBoxAHeight * 0.1);


          for (let l = minWordB; l < hocrBWords.length; l++){
            const hocrBWord = hocrBWords[l];
            const hocrBWordID = hocrBWord.getAttribute("id");
            const titleStrWordB = hocrBWord.getAttribute('title');
            const wordBoxB = [...titleStrWordB.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });

            // Remove 10% from all sides of ground truth bounding box
            // This prevents small overlapping (around the edges) from triggering a comparison
            const wordBoxBWidth = wordBoxB[2] - wordBoxB[0];
            const wordBoxBHeight = wordBoxB[3] - wordBoxB[1];

            wordBoxB[0] = wordBoxB[0] + Math.round(wordBoxBWidth * 0.1);
            wordBoxB[2] = wordBoxB[2] - Math.round(wordBoxBWidth * 0.1);

            wordBoxB[1] = wordBoxB[1] + Math.round(wordBoxBHeight * 0.1);
            wordBoxB[3] = wordBoxB[3] - Math.round(wordBoxBHeight * 0.1);

            // If left of word A is past right of word B, move to next word B
            if (wordBoxA[0] > wordBoxB[2]) {
              minWordB = minWordB + 1;
              continue;

            // If left of word B is past right of word A, move to next word A
            // (We assume no match is possible for any B)
            } else if (wordBoxB[0] > wordBoxA[2]) {
              break;

            // Otherwise, overlap is likely
            } else {
              // Check for overlap using word height
              if (wordBoxA[1] > wordBoxB[3] || wordBoxB[1] > wordBoxA[3]) {
                continue;
              }

              hocrAWord.setAttribute("compCount", (parseInt(hocrAWord.getAttribute("compCount")) + 1).toString());
              let wordTextA = replaceLigatures(hocrAWord.textContent);
              let wordTextB = replaceLigatures(hocrBWord.textContent);
              if (ignorePunctElem.checked) {
                wordTextA = wordTextA.replace(/[\W_]/g, "");
                wordTextB = wordTextB.replace(/[\W_]/g, "");
              }
              if (ignoreCapElem.checked) {
                wordTextA = wordTextA.toLowerCase();
                wordTextB = wordTextB.toLowerCase();
              }

              hocrAOverlap[hocrAWordID] = 1;
              hocrBOverlap[hocrBWordID] = 1;

              // TODO: Account for cases without 1-to-1 mapping between bounding boxes
              if (wordTextA == wordTextB) {
                hocrAWord.setAttribute("compStatus", "1");
                hocrBCorrect[hocrBWordID] = 1;
              } else {
                //hocrAWord.setAttribute("compStatus", "0");
                hocrAWord.setAttribute("compStatus", hocrAWord.getAttribute("compStatus") || "0");
              }
            }
          }
        }
      }
    }
  }

  // Note: These metrics leave open the door for some fringe edge cases.
  // For example,

  // Number of words in ground truth
  const totalCountB = hocrB.getElementsByClassName("ocrx_word").length;

  // Number of words in candidate OCR
  const totalCountA = hocrA.getElementsByClassName("ocrx_word").length;

  // Number of words in ground truth with any overlap with candidate OCR
  const overlapCountB = Object.keys(hocrBOverlap).length;

  // Number of words in candidate OCR with any overlap with ground truth
  const overlapCountA = Object.keys(hocrAOverlap).length;

  // Number of words in ground truth correctly identified by 1+ overlapping word in candidate OCR
  const correctCount = Object.keys(hocrBCorrect).length;

  // Number of words in ground truth not identified by 1+ overlapping word in candidate OCR
  const incorrectCount = overlapCountB - correctCount;

  const metricsRet = [totalCountB, correctCount, incorrectCount, (totalCountB - overlapCountB), (totalCountA - overlapCountA)];

  return ([hocrA, metricsRet]);
}

function replaceLigatures(x) {
  return x.replace(/ﬂ/g, "fl").replace(/ﬁ/g, "fi").replace(/ﬀ/g, "ff").replace(/ﬃ/g, "ffi").replace(/ﬄ/g, "ffl");
}


// var recognizeAreaScheduler;
window.recognizeAreaScheduler = null;
async function recognizeArea(left, top, width, height, wordMode = false) {

  if (inputDataModes.xmlMode[currentPage.n]) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }

  const allConfig = getTesseractConfigs();

  // Do not use character-level data.
  // The character-level data is not used for font kerning metrics, as at present only 1 font is optimized,
  // and the text Tesseract misses using "Recognize All" is generally not from the body text (usually page numbers).
  allConfig.hocr_char_boxes = '0';

  if (wordMode) {
    allConfig.tessedit_pageseg_mode = Tesseract.PSM["SINGLE_WORD"];
  }

  // Create new scheduler if one does not exist, or the existing scheduler was created using different settings
  if (!checkTesseractScheduler(recognizeAreaScheduler, allConfig)) {
    if (recognizeAreaScheduler) {
      await recognizeAreaScheduler.terminate()
      recognizeAreaScheduler = null;
    }
    recognizeAreaScheduler = await createTesseractScheduler(1, allConfig);
  }
  allConfig.rectangle = { left, top, width, height };

  const inputImage = await window.imageAll[currentPage.n];

  const res = await recognizeAreaScheduler.addJob('recognize', inputImage.src, allConfig);
  let hocrString = res.data.hocr;

  console.log(hocrString);

  const lines = currentPage.xmlDoc?.getElementsByClassName("ocr_line");

  // If no page exists already, simply use the new scan without editing
  if (!lines || lines.length == 0) {
    //convertPageWorker.postMessage([hocrString, currentPage.n, false, true]);
    convertPage([hocrString, currentPage.n, false, true, undefined, undefined]);
    return;
    //currentPage.xmlDoc = currentPage.xmlDoc = parser.parseFromString(hocrString, "text/xml");

  }

  // Perform various string cleaning functions.  These are largely copied from convertPage.js

  // Remove all bold/italics tags.  These complicate the syntax and are unfortunately virtually always wrong anyway (coming from Tesseract).
  hocrString = hocrString.replaceAll(/<\/?strong>/ig, "");
  hocrString = hocrString.replaceAll(/<\/?em>/ig, "");

  // Delete namespace to simplify xpath
  hocrString = hocrString.replace(/<html[^>]*>/i, "<html>");

  // Replace various classes with "ocr_line" class for simplicity
  // At least in Tesseract, these elements are not identified accurately or consistently enough to warrent different treatment.
  hocrString = hocrString.replace(/(class=\')ocr_caption/ig, "$1ocr_line");
  hocrString = hocrString.replace(/(class=\')ocr_textfloat/ig, "$1ocr_line");
  hocrString = hocrString.replace(/(class=\')ocr_header/ig, "$1ocr_line");

  // Differs from convertPage.js by only requiring 2 consecutive closing span tags (as no character-level elements are present)
  const lineRegex = new RegExp(/<span class\=[\"\']ocr_line[\s\S]+?(?:\<\/span\>\s*){2}/, "ig");
  const hocrLinesArr = hocrString.match(lineRegex);

  if (!hocrLinesArr) return;

  // Otherwise, integrate the new data into the existing data
  for (let i = 0; i < hocrLinesArr.length; i++) {
    const lineNewStr = hocrLinesArr[i];
    const titleStrLine = lineNewStr.match(/title\=[\'\"]([^\'\"]+)/)?.[1];
    const lineNew = parser.parseFromString(lineNewStr, "text/xml").firstChild;
    if (![...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]) {
      return;
    }
    const lineBoxNew = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]?.slice(1, 5).map(function (x) { return parseInt(x); });

    // For whatever reason Tesseract sometimes returns junk data with negative coordinates.
    // In such cases, the above regex will fail to match anything.
    if (!lineBoxNew) return;

    // Identify the OCR line a bounding box is in (or closest line if no match exists)
    const sinAngle = Math.sin(pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180));
    let lineI = -1;
    let match = false;
    let newLastLine = false;
    let lineBottomHOCR, line, lineMargin;
    do {
      lineI = lineI + 1;
      line = lines[lineI];
      const titleStrLine = line.getAttribute('title');
      const lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
      let baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);

      let boxOffsetY = 0;
      let lineBoxAdj = lineBox.slice();
      if (baseline != null) {
        baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });

        // Adjust box such that top/bottom approximate those coordinates at the leftmost point.
        if (baseline[0] < 0) {
          lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        } else {
          lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        }
        //boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * baseline[0];
        boxOffsetY = (lineBoxNew[0] + (lineBoxNew[2] - lineBoxNew[0]) / 2 - lineBoxAdj[0]) * sinAngle;
      } else {
        baseline = [0, 0];
      }

      // Calculate size of margin to apply when detecting overlap (~30% of total height applied to each side)
      // This prevents a very small overlap from causing a word to be placed on an existing line
      const lineHeight = lineBoxAdj[3] - lineBoxAdj[1];
      lineMargin = Math.round(lineHeight * 0.30);

      let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
      lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;

      if ((lineTopHOCR + lineMargin) < lineBoxNew[3] && (lineBottomHOCR - lineMargin) >= lineBoxNew[1]) match = true;
      if ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 == lines.length) newLastLine = true;

    } while ((lineBottomHOCR - lineMargin) < lineBoxNew[1] && lineI + 1 < lines.length);

    let words = line.getElementsByClassName("ocrx_word");
    let wordsNew = lineNew.getElementsByClassName("ocrx_word");

    if (match) {
      for (let i = 0; i < wordsNew.length; i++) {
        let wordNew = wordsNew[i];

        // Identify closest word on existing line
        let word, box;
        let j = 0;
        do {
          word = words[j];
          if (!word.childNodes[0]?.textContent.trim()) continue;
          let titleStr = word.getAttribute('title') ?? "";
          box = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
          j = j + 1;
        } while (box[2] < lineBoxNew[0] && j < words.length);

        // Replace id (which is likely duplicative) with unique id
        let wordChosenID = word.getAttribute('id');
        let wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
        wordNew.setAttribute("id", wordIDNew)

        // Add to page XML
        if (i == words.length) {
          word.insertAdjacentElement("afterend", wordNew);
        } else {
          word.insertAdjacentElement("beforebegin", wordNew);
        }
      }
    } else {
      // Replace id (which is likely duplicative) with unique id
      let lineChosenID = lineNew.getAttribute('id');
      let lineIDNew = lineChosenID + getRandomAlphanum(3).join('');
      lineNew.setAttribute("id", lineIDNew);

      for (let i = 0; i < wordsNew.length; i++) {
        let wordNew = wordsNew[i];

        // Replace id (which is likely duplicative) with unique id
        let wordChosenID = wordNew.getAttribute('id');
        let wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
        wordNew.setAttribute("id", wordIDNew)
      }

      if (newLastLine) {
        line.insertAdjacentElement("afterend", lineNew);
      } else {
        line.insertAdjacentElement("beforebegin", lineNew);
      }
    }
  }

  globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;

  await renderPageQueue(currentPage.n);

}


async function recognizeAll() {

  loadCountHOCR = 0;

  convertPageWorker["activeProgress"] = initializeProgress("recognize-recognize-progress-collapse", imageAll.length);

  // Render all pages to PNG
  if (inputDataModes.pdfMode) {
    await initSchedulerIfNeeded("muPDFScheduler");

    //muPDFScheduler["activeProgress"] = initializeProgress("render-recognize-progress-collapse", imageAll.length, muPDFScheduler["pngRenderCount"]);
    let time1 = Date.now();
    await renderPDFImageCache([...Array(imageAll.length).keys()]);
    let time2 = Date.now();
    console.log("renderPDFImageCache runtime: " + (time2 - time1) / 1e3 + "s");

  }

  const allConfig = getTesseractConfigs();

  const oemText = "Tesseract " + document.getElementById("oemLabelText").innerHTML;
  addDisplayLabel(oemText);
  setCurrentHOCR(oemText);

  let recognizeImages = async (pagesArr, workerN) => {
    let time1 = Date.now();
    const scheduler = await createTesseractScheduler(workerN);

    const rets = await Promise.allSettled(pagesArr.map(async (x) => {
      const allConfigI = JSON.parse(JSON.stringify(allConfig));

      // Whether the binary image should be rotated
      const rotateBinary = true;
      const angleArg = rotateBinary ? pageMetricsObj["angleAll"][x] * (Math.PI / 180) * -1 || 0 : 0;
      allConfigI["angle"] = angleArg;

      const inputImage = await window.imageAll[x];

      return scheduler.addJob('recognize', inputImage.src, allConfigI).then(async (y) => {
        const image = document.createElement('img');
        image.src = y.data.image;
        window.imageAllBinary[x] = image;
        window.imageAllBinaryRotated[x] = Boolean(allConfigI["angle"]);
        window.hocrCurrentRaw[x] = y.data.hocr;

        // If the angle is already known, run once async
        if (pageMetricsObj["angleAll"]?.[x]) {
          convertPage([y.data.hocr, x, false, false, oemText, pageMetricsObj["angleAll"][x]]).then(() => updateConvertPageCounter());
        } else {
          // If the angle is not already known, we wait until recognition finishes so we know the angle
          await convertPage([y.data.hocr, x, false, false, oemText, pageMetricsObj["angleAll"][x]]);
          // If the angle is >1 degree, we rerun with the known angle (which results in the image being rotated in pre-processing step)
          if (Math.abs(pageMetricsObj["angleAll"][x]) >= 1) {
            const angleArg = rotateBinary ? pageMetricsObj["angleAll"][x] * (Math.PI / 180) * -1 || 0 : 0;
            allConfigI["angle"] = angleArg;
            const inputImage = await window.imageAll[x];
            return scheduler.addJob('recognize', inputImage.src, allConfigI).then(async (y) => {
              window.hocrCurrentRaw[x] = y.data.hocr;
              convertPage([y.data.hocr, x, false, false, oemText, pageMetricsObj["angleAll"][x]]).then(() => updateConvertPageCounter());
            });
          } else {
            updateConvertPageCounter();
          }
        }
        // convertPageWorker.postMessage([y.data.hocr, x, false, false, oemText, pageMetricsObj["angleAll"][x]]);
      })

    }));

    await scheduler.terminate();

    let time2 = Date.now();
    console.log("Runtime: " + (time2 - time1) / 1e3 + "s");
  }

  let workerN = Math.round((globalThis.navigator.hardwareConcurrency || 8) / 2);
  // Use at most 6 workers.  While some systems could support many more workers in theory,
  // browser-imposed memory limits make this problematic in reality.
  workerN = Math.min(workerN, 6);
  // Do not create more workers than there are pages
  workerN = Math.min(workerN, Math.ceil(globalThis.imageAll.length));

  console.log("Using " + workerN + " workers for OCR.")

  recognizeImages([...Array(globalThis.imageAll.length).keys()], workerN);

  // Enable confidence threshold input boxes (only used for Tesseract)
  confThreshHighElem.disabled = false;
  confThreshMedElem.disabled = false;

  // Set threshold values if not already set
  confThreshHighElem.value = confThreshHighElem.value || "85";
  confThreshMedElem.value = confThreshMedElem.value || "75";

  toggleEditButtons(false);

}

var rect1;
function recognizeAreaClick(wordMode = false) {

  canvas.on('mouse:down', function (o) {
    let pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;
    rect1 = new fabric.Rect({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      width: pointer.x - origX,
      height: pointer.y - origY,
      angle: 0,
      fill: 'rgba(255,0,0,0.5)',
      transparentCorners: false
    });
    canvas.add(rect1);
    canvas.renderAll();
    canvas.on('mouse:move', function (o) {
      let pointer = canvas.getPointer(o.e);

      if (origX > pointer.x) {
        rect1.set({ left: Math.abs(pointer.x) });
      }
      if (origY > pointer.y) {
        rect1.set({ top: Math.abs(pointer.y) });
      }

      rect1.set({ width: Math.abs(origX - pointer.x) });
      rect1.set({ height: Math.abs(origY - pointer.y) });

      canvas.renderAll();
    });
  }, {once: true});

  // mouse:up:before must be used so this code runs ahead of fabric internal logic.
  // Without this changes to active selection caused by mouse movement may change rect object.
  canvas.on('mouse:up:before', async function (o) {

    // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
    let angleAdjXRect = 0;
    let angleAdjYRect = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n] ?? 0) > 0.05) {
      // angleAdjXRect = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (rect1.top + rect1.height * 0.5);
      // angleAdjYRect = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (rect1.left + angleAdjXRect / 2) * -1;

      const rotateAngle = globalThis.pageMetricsObj["angleAll"][currentPage.n];

      const pageDims = globalThis.pageMetricsObj["dimsAll"][currentPage.n];

      const sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
      const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

      const shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
      const shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

      const baselineY = rect1.top + rect1.height - rect1.height / 3;

      const angleAdjYInt = (1 - cosAngle) * baselineY - sinAngle * rect1.left;
      const angleAdjXInt = sinAngle * (baselineY - angleAdjYInt * 0.5);

      angleAdjXRect = shiftX + angleAdjXInt;
      angleAdjYRect = shiftY + angleAdjYInt;

    }

    // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
    const top = rect1.top - angleAdjYRect;
    const left = rect1.left - angleAdjXRect - currentPage.leftAdjX;


    const width = rect1.width;
    const height = rect1.height;


    canvas.remove(rect1);

    if (width < 4 || height < 4) return;

    await recognizeArea(left, top, width, height, wordMode);

    canvas.renderAll();
    canvas.__eventListeners = {}
  }, { once: true });

}


var newWordInit = true;

var rect, origX, origY;
function addWordClick() {
  newWordInit = false;

  canvas.on('mouse:down', function (o) {
    let pointer = canvas.getPointer(o.e);
    origX = pointer.x;
    origY = pointer.y;
    rect = new fabric.Rect({
      left: origX,
      top: origY,
      originX: 'left',
      originY: 'top',
      width: pointer.x - origX,
      height: pointer.y - origY,
      angle: 0,
      fill: 'rgba(255,0,0,0.5)',
      transparentCorners: false
    });
    canvas.add(rect);
    canvas.renderAll();

    canvas.on('mouse:move', function (o) {

      let pointer = canvas.getPointer(o.e);

      if (origX > pointer.x) {
        rect.set({ left: Math.abs(pointer.x) });
      }
      if (origY > pointer.y) {
        rect.set({ top: Math.abs(pointer.y) });
      }

      rect.set({ width: Math.abs(origX - pointer.x) });
      rect.set({ height: Math.abs(origY - pointer.y) });

      canvas.renderAll();
    });

  });

  // mouse:up:before must be used so this code runs ahead of fabric internal logic.
  // Without this changes to active selection caused by mouse movement may change rect object.
  canvas.on('mouse:up:before', function (o) {

    canvas.__eventListeners = {}
    if (newWordInit) { return; }
    newWordInit = true;


    let fillColorHex = "#00ff7b";

    let opacity_arg, fill_arg;
    if (displayModeElem.value == "invis") {
      opacity_arg = 0;
      fill_arg = "black";
    } else if (displayModeElem.value == "ebook") {
      opacity_arg = 1;
      fill_arg = "black";
    } else {
      opacity_arg = 1;
      fill_arg = fillColorHex;
    }

    let lineBoxChosen, baselineChosen, titleStrLineChosen, wordIDNew;
    let wordText = "A";
    // Calculate offset between HOCR coordinates and canvas coordinates (due to e.g. roatation)
    let angleAdjXRect = 0;
    let angleAdjYRect = 0;
    let sinAngle = 0;
    let shiftX = 0;
    let shiftY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n] ?? 0) > 0.05) {
      // angleAdjXRect = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (rect.top + rect.height * 0.5);
      // angleAdjYRect = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (rect.left + angleAdjXRect / 2) * -1;

      const rotateAngle = globalThis.pageMetricsObj["angleAll"][currentPage.n];

      const pageDims = globalThis.pageMetricsObj["dimsAll"][currentPage.n];

      sinAngle = Math.sin(rotateAngle * (Math.PI / 180));
      const cosAngle = Math.cos(rotateAngle * (Math.PI / 180));

      shiftX = sinAngle * (pageDims[0] * 0.5) * -1 || 0;
      shiftY = sinAngle * ((pageDims[1] - shiftX) * 0.5) || 0;

      const baselineY = (rect.top + rect.height) - (rect.height) / 3;

      const angleAdjYInt = (1 - cosAngle) * (baselineY - shiftY) - sinAngle * (rect.left - shiftX);
      const angleAdjXInt = sinAngle * ((baselineY - shiftY) - angleAdjYInt * 0.5);

      angleAdjXRect = angleAdjXInt + shiftX;
      angleAdjYRect = angleAdjYInt + shiftY;

    }

    // Calculate coordinates as they would appear in the HOCR file (subtracting out all transformations)
    let rectTopHOCR = rect.top - angleAdjYRect;
    let rectBottomHOCR = rect.top + rect.height - angleAdjYRect;

    let rectTopCoreHOCR = Math.round(rect.top + rect.height * 0.2 - angleAdjYRect);
    let rectBottomCoreHOCR = Math.round(rect.top + rect.height * 0.8 - angleAdjYRect);

    let rectLeftHOCR = rect.left - angleAdjXRect - currentPage.leftAdjX;
    let rectRightHOCR = rect.left + rect.width - angleAdjXRect - currentPage.leftAdjX;
    let rectMidHOCR = rect.left + rect.width * 0.5 - angleAdjXRect - currentPage.leftAdjX;

    let lines = currentPage.xmlDoc.getElementsByClassName("ocr_line");

    // Identify the OCR line a bounding box is in (or closest line if no match exists)
    let lineI = -1;
    let match = false;
    let newLastLine = false;
    let line, lineBox, baseline, lineBottomHOCR, titleStrLine, fontSize;
    do {
      lineI = lineI + 1;
      line = lines[lineI];
      titleStrLine = line.getAttribute('title');
      if (![...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0]) {
        debugger;
      }
      lineBox = [...titleStrLine.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
      baseline = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);

      let boxOffsetY = 0;
      let lineBoxAdj = lineBox.slice();
      if (baseline != null) {
        baseline = baseline.slice(1, 5).map(function (x) { return parseFloat(x); });

        // Adjust box such that top/bottom approximate those coordinates at the leftmost point.
        if (baseline[0] < 0) {
          lineBoxAdj[1] = lineBoxAdj[1] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        } else {
          lineBoxAdj[3] = lineBoxAdj[3] - (lineBoxAdj[2] - lineBoxAdj[0]) * baseline[0];
        }
        //boxOffsetY = (rectMidHOCR - lineBoxAdj[0]) * baseline[0];
        boxOffsetY = (rectMidHOCR - lineBoxAdj[0]) * sinAngle;
      } else {
        baseline = [0, 0];
      }

      let lineTopHOCR = lineBoxAdj[1] + boxOffsetY;
      lineBottomHOCR = lineBoxAdj[3] + boxOffsetY;
      if (lineTopHOCR < rectBottomCoreHOCR && lineBottomHOCR >= rectTopCoreHOCR) match = true;
      if (lineBottomHOCR < rectTopCoreHOCR && lineI + 1 == lines.length) newLastLine = true;

    } while (lineBottomHOCR < rectTopCoreHOCR && lineI + 1 < lines.length);

    // line is set to either the matched line or a nearby line
    //let line = match ? lines[lineI] : lines[Math.min(i-1,0)];

    let words = line.getElementsByClassName("ocrx_word");
    // Case when a word is being added to an existing line
    if (match) {

      lineBoxChosen = lineBox;
      baselineChosen = baseline;
      titleStrLineChosen = titleStrLine;

      // Identify closest word on existing line
      let word, box;
      let i = 0;
      do {
        word = words[i];
        if (!word.childNodes[0]?.textContent.trim()) continue;
        let titleStr = word.getAttribute('title') ?? "";
        box = [...titleStr.matchAll(/bbox(?:es)?(\s+\d+)(\s+\d+)?(\s+\d+)?(\s+\d+)?/g)][0].slice(1, 5).map(function (x) { return parseInt(x); });
        i = i + 1;
      } while (box[2] < rect.left && i < words.length);

      let wordChosenID = word.getAttribute('id');
      let wordBox = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

      // Append 3 random characters to avoid conflicts without having to keep track of all words
      wordIDNew = wordChosenID + getRandomAlphanum(3).join('');
      const wordNewStr = '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + wordBox.join(' ') + ';x_wconf 100">' + wordText + '</span>'

      const wordNew = parser.parseFromString(wordNewStr, "text/xml");

      if (i == words.length) {
        word.insertAdjacentElement("afterend", wordNew.firstChild);
      } else {
        word.insertAdjacentElement("beforebegin", wordNew.firstChild);
      }

      // TODO: Update metrics of lines if a first/last word is added

      // Case when new word requires a new line be created
    } else {

      let word = line.getElementsByClassName("ocrx_word")[0];
      let wordID = word.getAttribute('id');
      wordIDNew = wordID.replace(/\w{1,5}_\w+/, "$&" + getRandomAlphanum(3).join(''));

      lineBoxChosen = [rectLeftHOCR, rectTopHOCR, rectRightHOCR, rectBottomHOCR].map(x => Math.round(x));

      // If this is the first/last line on the page, assume the textbox height is the "A" height.
      // This is done because when a first/last line is added manually, it is often page numbers,
      // and is often not the same font size as other lines.
      let sizeStr;
      if (lineI == 0 || lineI + 1 == lines.length) {
        sizeStr = "x_size " + Math.round(rect.height) + ";";
        baselineChosen = [0, 0];

        // If the new line is between two existing lines, use metrics from nearby line to determine text size
      } else {
        let letterHeight = titleStrLine.match(/x_size\s+([\d\.\-]+)/);

        let ascHeight = titleStrLine.match(/x_ascenders\s+([\d\.\-]+)/);
        let descHeight = titleStrLine.match(/x_descenders\s+([\d\.\-]+)/);
        letterHeight = letterHeight != null ? "x_size " + letterHeight[1] : "";
        ascHeight = ascHeight != null ? "x_ascenders " + ascHeight[1] : "";
        descHeight = descHeight != null ? "x_descenders " + descHeight[1] : "";
        sizeStr = [letterHeight, ascHeight, descHeight].join(';');

        // Check if these stats are significantly different from the box the user specified
        let letterHeightFloat = parseFloat(letterHeight.match(/[\d\.\-]+/)?.[0]) || 0;
        let descHeightFloat = parseFloat(descHeight.match(/[\d\.\-]+/)?.[0]) || 0;

        if ((letterHeightFloat - descHeightFloat) > rect.height * 1.5) {
          sizeStr = "x_size " + Math.round(rect.height) + ";";
          baselineChosen = [0, 0];
        }

        let baselineStr = titleStrLine.match(/baseline(\s+[\d\.\-]+)(\s+[\d\.\-]+)/);
        if (baselineStr != null) {
          baselineChosen = baselineStr.slice(1, 5).map(function (x) { return parseInt(x); });
        } else {
          baselineChosen = [0, 0];
        }
      }
      titleStrLineChosen = 'bbox ' + lineBoxChosen.join(' ') + ';baseline ' + baselineChosen.join(' ') + ';' + sizeStr;

      let lineXmlNewStr = '<span class="ocr_line" title="' + titleStrLineChosen + '">';
      lineXmlNewStr = lineXmlNewStr + '<span class="ocrx_word" id="' + wordIDNew + '" title="bbox ' + lineBoxChosen.join(' ') + ';x_wconf 100">' + wordText + '</span>'
      lineXmlNewStr = lineXmlNewStr + "</span>"

      const lineXmlNew = parser.parseFromString(lineXmlNewStr, "text/xml");

      if (newLastLine) {
        line.insertAdjacentElement("afterend", lineXmlNew.firstChild);
      } else {
        line.insertAdjacentElement("beforebegin", lineXmlNew.firstChild);
      }
    }

    // Adjustments are recalculated using the actual bounding box (which is different from the initial one calculated above)
    let angleAdjX = 0;
    let angleAdjY = 0;
    if (autoRotateCheckboxElem.checked && Math.abs(globalThis.pageMetricsObj["angleAll"][currentPage.n] ?? 0) > 0.05) {
      // angleAdjX = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (lineBoxChosen[3] + baselineChosen[1]);
      // angleAdjY = Math.sin(globalThis.pageMetricsObj["angleAll"][currentPage.n] * (Math.PI / 180)) * (lineBoxChosen[0] + angleAdjX / 2) * -1;

      const angleAdjXInt = sinAngle * (lineBoxChosen[3] + baselineChosen[1]);
      const angleAdjYInt = sinAngle * (lineBoxChosen[0] + angleAdjXInt / 2) * -1;

      angleAdjX = angleAdjXInt + shiftX;
      angleAdjY = angleAdjYInt + shiftY;

    }

    let letterHeight = parseFloat(titleStrLineChosen.match(/x_size\s+([\d\.\-]+)/)?.[1]);
    let ascHeight = parseFloat(titleStrLineChosen.match(/x_ascenders\s+([\d\.\-]+)/)?.[1]);
    let descHeight = parseFloat(titleStrLineChosen.match(/x_descenders\s+([\d\.\-]+)/)?.[1]);

    if (letterHeight && ascHeight && descHeight) {
      let xHeight = letterHeight - ascHeight - descHeight;
      fontSize = getFontSize(globalSettings.defaultFont, xHeight, "o", ctx);
    } else if (letterHeight) {
      fontSize = getFontSize(globalSettings.defaultFont, letterHeight, "A", ctx);
    }

    ctx.font = 1000 + 'px ' + globalSettings.defaultFont;
    const oMetrics = ctx.measureText("o");
    const jMetrics = ctx.measureText("gjpqy");
    ctx.font = fontSize + 'px ' + globalSettings.defaultFont;

    // The function fontBoundingBoxDescent currently is not enabled by default in Firefox.
    // Can return to this simpler code if that changes.
    // https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics/fontBoundingBoxDescent
    //let fontDesc = (jMetrics.fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    let fontBoundingBoxDescent = Math.round(Math.abs(fontObj[globalSettings.defaultFont]["normal"].descender) * (1000 / fontObj[globalSettings.defaultFont]["normal"].unitsPerEm));

    let fontDesc = (fontBoundingBoxDescent - oMetrics.actualBoundingBoxDescent) * (fontSize / 1000);

    let top = lineBoxChosen[3] + baselineChosen[1] + fontDesc + angleAdjY;

    let textbox = new fabric.IText(wordText, {
      left: rect.left,
      top: top,
      leftOrig: rect.left,
      topOrig: top,
      baselineAdj: 0,
      wordSup: false,
      originY: "bottom",
      fill: fill_arg,
      fill_proof: fillColorHex,
      fill_ebook: 'black',
      fontFamily: globalSettings.defaultFont,
      fontStyle: "normal",
      wordID: wordIDNew,
      //line: i,
      boxWidth: rect.width,
      defaultFontFamily: true,
      opacity: 1,
      //charSpacing: kerning * 1000 / wordFontSize
      fontSize: fontSize
    });


    textbox.on('editing:exited', function () {
      if (this.hasStateChanged) {
        if (document.getElementById("smartQuotes").checked && /[\'\"]/.test(this.text)) {
          let textInt = this.text;
          textInt = textInt.replace(/(^|[-–—])\'/, "$1‘");
          textInt = textInt.replace(/(^|[-–—])\"/, "$1“");
          textInt = textInt.replace(/\'(?=$|[-–—])/, "’");
          textInt = textInt.replace(/\"(?=$|[-–—])/, "”");
          textInt = textInt.replace(/([a-z])\'(?=[a-z]$)/i, "$1’");
          this.text = textInt;
        }
        const wordWidth = calcWordWidth(this.text, this.fontFamily, this.fontSize, this.fontStyle);
        if (this.text.length > 1) {
          const kerning = round3((this.boxWidth - wordWidth) / (this.text.length - 1));
          this.charSpacing = kerning * 1000 / this.fontSize;
        }
        updateHOCRWord(this.wordID, this.text)
      }
    });
    textbox.on('selected', function () {
      if (!this.defaultFontFamily && Object.keys(fontObj).includes(this.fontFamily)) {
        wordFontElem.value = this.fontFamily;
      }
      fontSizeElem.value = this.fontSize;

    });
    textbox.on('deselected', function () {
      wordFontElem.value = "Default";
      bsCollapse.hide();
      rangeBaselineElem.value = "100";
    });

    textbox.on('modified', (opt) => {
      // inspect action and check if the value is what you are looking for
      if (opt.action == "scaleX") {
        const textboxWidth = opt.target.calcTextWidth()
        const wordMetrics = calcWordMetrics(opt.target.text, opt.target.fontFamily, opt.target.fontSize, opt.target.fontStyle);
        const widthCalc = (textboxWidth - wordMetrics[1]) * opt.target.scaleX;

        let rightNow = opt.target.left + widthCalc;
        let rightOrig = opt.target.leftOrig + opt.target.boxWidth;

        updateHOCRBoundingBoxWord(opt.target.wordID, Math.round(opt.target.left - opt.target.leftOrig), Math.round(rightNow - rightOrig));
        if (opt.target.text.length > 1) {


          const widthDelta = widthCalc - opt.target.boxWidth;
          if (widthDelta != 0) {
            const charSpacingDelta = (widthDelta / (opt.target.text.length - 1)) * 1000 / opt.target.fontSize;
            opt.target.charSpacing = (opt.target.charSpacing ?? 0) + charSpacingDelta;
            opt.target.scaleX = 1;
          }

        }

        opt.target.leftOrig = opt.target.left;
        opt.target.boxWidth = Math.round(rightNow - opt.target.left - wordMetrics[1]);

      }
    });

    canvas.remove(rect);
    canvas.add(textbox);
    canvas.renderAll();
    canvas.__eventListeners = {}

  });
}

// Resets the environment.
var fontMetricObjsMessage, loadCountHOCR;
function clearFiles() {

  currentPage.n = 0;

  window.imageAll = [];
  window.hocrCurrent = [];
  window.fontMetricsObj = {};
  window.pageMetricsObj = {};
  fontMetricObjsMessage = {};

  if (window.binaryScheduler) {
    window.binaryScheduler.terminate();
    window.binaryScheduler = null;
  }

  if (window.muPDFScheduler) {
    window.binaryScheduler.terminate();
    window.binaryScheduler = null;
  }

  loadCountHOCR = 0;

  canvas.clear()
  pageCountElem.textContent = "";
  pageNumElem.value = "";
  downloadFileNameElem.value = "";
  uploaderElem.value = "";
  optimizeFontElem.checked = false;
  optimizeFontElem.disabled = true;
  downloadElem.disabled = true;
  confThreshHighElem.disabled = true;
  confThreshMedElem.disabled = true;
  recognizeAllElem.disabled = true;
  recognizePageElem.disabled = true;
  recognizeAreaElem.disabled = true;
  createGroundTruthElem.disabled = true;
  // compareGroundTruthElem.disabled = true;
  uploadOCRButtonElem.disabled = true;
  toggleEditButtons(true);

}

clearFiles();



async function importOCRFiles() {
  // TODO: Add input validation for names (e.g. unique, no illegal symbols, not named "Ground Truth" or other reserved name)
  const ocrName = uploadOCRNameElem.value;
  const hocrFilesAll = uploadOCRFileElem.files;

  if (hocrFilesAll.length == 0) return;

  displayLabelTextElem.disabled = true;

  const mainData = false;

  if (mainData) {
    fontMetricObjsMessage["widthObjAll"] = new Array();
    fontMetricObjsMessage["heightObjAll"] = new Array();
    fontMetricObjsMessage["kerningObjAll"] = new Array();
    fontMetricObjsMessage["cutObjAll"] = new Array();
    fontMetricObjsMessage["heightSmallCapsObjAll"] = new Array();
    fontMetricObjsMessage["messageAll"] = new Object();

    globalThis.pageMetricsObj["angleAll"] = new Array();
    globalThis.pageMetricsObj["dimsAll"] = new Array();
    globalThis.pageMetricsObj["leftAll"] = new Array();
    globalThis.pageMetricsObj["angleAdjAll"] = new Array();
    globalThis.pageMetricsObj["manAdjAll"] = new Array();
  }

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1 ? true : false;

  let hocrStrStart = "";
  let hocrStrEnd = "";
  let abbyyMode, hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

  //displayLabelTextElem.innerHTML = ocrName;

  if (singleHOCRMode) {
    const singleHOCRMode = true;
    let hocrStrAll = await readOcrFile(hocrFilesAll[0]);

    // Check whether input is Abbyy XML
    const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
    abbyyMode = /abbyy/i.test(node2) ? true : false;

    if (abbyyMode) {

      hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
      hocrArrPages = hocrStrPages.split(/(?=\<page)/);
    } else {

      // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
      inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

      if (inputDataModes.resumeMode) {
        let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
        let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\/?\>)/i)[1].replace(/&quot;/g, '"');
        globalThis.fontMetricsObj = JSON.parse(contentStr);

      }

      hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
      hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
      hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
      hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
      hocrStrPages = hocrStrPages.trim();

      hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
    }

    pageCountHOCR = hocrArrPages.length;
    window.hocrCurrentRaw = Array(pageCountHOCR);
    for (let i = 0; i < pageCountHOCR; i++) {
      window.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
    }

  } else {
    const singleHOCRMode = false;
    pageCountHOCR = hocrFilesAll.length;

    // Check whether input is Abbyy XML using the first file
    let hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
    const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
    abbyyMode = /abbyy/i.test(node2) ? true : false;
  }

  // Enable confidence threshold input boxes (only used for Tesseract)
  if (!abbyyMode && confThreshHighElem.disabled) {
    confThreshHighElem.disabled = false;
    confThreshMedElem.disabled = false;
    confThreshHighElem.value = "85";
    confThreshMedElem.value = "75";
  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (window.imageAll) {
    if (window.imageAll.length != pageCountHOCR) {
      document.getElementById("pageMismatchAlertTextRec").textContent = " Page mismatch detected. Image data has " + pageCountImage + " pages while OCR data has " + pageCountHOCR + " pages."
      document.getElementById("pageMismatchAlertRec").setAttribute("style", "");
    }
  }

  loadCountHOCR = 0;
  convertPageWorker["activeProgress"] = initializeProgress("import-eval-progress-collapse", pageCountHOCR);

  toggleEditButtons(false);
  for (let i = 0; i < pageCountHOCR; i++) {

    // Process HOCR using web worker, reading from file first if that has not been done already
    if (singleHOCRMode) {
      //convertPageWorker.postMessage([window.hocrCurrentRaw[i], i, abbyyMode]);
      convertPage([window.hocrCurrentRaw[i], i, abbyyMode, undefined, undefined, undefined]).then(() => updateConvertPageCounter());
    } else {
      const hocrFile = hocrFilesAll[i];
      //readOcrFile(hocrFile).then((x) => convertPageWorker.postMessage([x, i]));
      readOcrFile(hocrFile).then((x) => convertPage([x, i, undefined, undefined, undefined, undefined]).then(() => updateConvertPageCounter()));
    }

  }

  uploadOCRNameElem.value = '';
  uploadOCRFileElem.value = '';
  new bootstrap.Collapse(uploadOCRDataElem, { toggle: true })

  addDisplayLabel(ocrName);
  setCurrentHOCR(ocrName);
  displayLabelTextElem.disabled = true;

}


async function importFiles() {

  const curFiles = uploaderElem.files;

  if (curFiles.length == 0) return;

  fontMetricObjsMessage["widthObjAll"] = new Array();
  fontMetricObjsMessage["heightObjAll"] = new Array();
  fontMetricObjsMessage["kerningObjAll"] = new Array();
  fontMetricObjsMessage["cutObjAll"] = new Array();
  fontMetricObjsMessage["heightSmallCapsObjAll"] = new Array();
  fontMetricObjsMessage["messageAll"] = new Object();

  globalThis.pageMetricsObj["angleAll"] = new Array();
  globalThis.pageMetricsObj["dimsAll"] = new Array();
  globalThis.pageMetricsObj["leftAll"] = new Array();
  globalThis.pageMetricsObj["angleAdjAll"] = new Array();
  globalThis.pageMetricsObj["manAdjAll"] = new Array();


  // Sort files into (1) HOCR files, (2) image files, or (3) unsupported using extension.
  let imageFilesAll = new Array();
  let hocrFilesAll = new Array();
  let pdfFilesAll = new Array()
  let unsupportedFilesAll = new Array();
  let unsupportedExt = new Object;
  for (let i = 0; i < curFiles.length; i++) {
    const file = curFiles[i];
    let fileExt = file.name.match(/\.([^\.]+)$/)?.[1].toLowerCase() || "";

    if (["png", "jpeg", "jpg"].includes(fileExt)) {
      imageFilesAll.push(file);
      // All .gz files are assumed to be OCR data (xml) since all other file types can be compressed already
    } else if (["hocr", "xml", "html", "gz"].includes(fileExt)) {
      hocrFilesAll.push(file);
    } else if (["pdf"].includes(fileExt)) {
      pdfFilesAll.push(file);
    } else {
      unsupportedFilesAll.push(file);
      unsupportedExt[fileExt] = true;
    }
  }

  inputDataModes.pdfMode = pdfFilesAll.length == 1 ? true : false;
  inputDataModes.imageMode = imageFilesAll.length > 0 && !inputDataModes.pdfMode ? true : false;

  const xmlModeImport = hocrFilesAll.length > 0 ? true : false;

  if (inputDataModes.imageMode || inputDataModes.pdfMode) {
    recognizeAllElem.disabled = false;
    recognizePageElem.disabled = false;
    recognizeAreaElem.disabled = false;
    createGroundTruthElem.disabled = false;
    uploadOCRButtonElem.disabled = false;

    // Color vs. grayscale is an option passed to mupdf, so can only be used with pdf inputs
    // Binary images are calculated separately by Leptonica (within Tesseract) so apply to both
    const colorModeElemOptions = colorModeElem.children;
    while (colorModeElemOptions.length > 0) {
      colorModeElemOptions[0].remove();
    }
    // for (let i = 0; i < colorModeElemOptions.length; i++){
    //   colorModeElemOptions[i].remove();
    // }
    if (inputDataModes.imageMode) {
      let option = document.createElement("option");
      option.text = "Native";
      option.value = "color";
      option.selected = true;
      colorModeElem.add(option);
    } else {
      let option = document.createElement("option");
      option.text = "Color";
      option.value = "color";
      colorModeElem.add(option);
      option = document.createElement("option");
      option.text = "Grayscale";
      option.value = "gray";
      option.selected = true;
      colorModeElem.add(option);
    }
    let option = document.createElement("option");
    option.text = "Binary";
    option.value = "binary";
    colorModeElem.add(option);
  }

  imageFilesAll.sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0))
  hocrFilesAll.sort();

  // Check that input makes sense.  Valid options are:
  // (1) N HOCR files and 0 image files
  // (1) N HOCR files and N image files
  // (1) 1 HOCR file and N image files
  if (hocrFilesAll.length > 1 && inputDataModes.imageMode && hocrFilesAll.length != imageFilesAll.length) {
    throw new Error('Detected ' + hocrFilesAll.length + ' hocr files but ' + imageFilesAll.length + " image files.")
  }

  // Set default download name
  let downloadFileName = pdfFilesAll.length > 0 ? pdfFilesAll[0].name : curFiles[0].name;
  downloadFileName = downloadFileName.replace(/\.\w{1,4}$/, "");
  downloadFileName = downloadFileName + ".pdf";
  downloadFileNameElem.value = downloadFileName;

  // In the case of 1 HOCR file
  const singleHOCRMode = hocrFilesAll.length == 1 ? true : false;

  //let pageCount, hocrCurrentRaw, abbyyMode;
  let hocrStrStart = "";
  let hocrStrEnd = "";
  let abbyyMode, hocrStrPages, hocrArrPages, pageCount, pageCountImage, pageCountHOCR;

  if (inputDataModes.pdfMode) {

    window.pdfFile = pdfFilesAll[0];

    // Initialize scheduler
    await initSchedulerIfNeeded("muPDFScheduler");

    pageCountImage = await muPDFScheduler.addJob('countPages', []);

  } else if (inputDataModes.imageMode) {
    pageCountImage = imageFilesAll.length;
  }

  if (xmlModeImport) {

    addDisplayLabel("User Upload");
    displayLabelTextElem.innerHTML = "User Upload";

    if (singleHOCRMode) {
      const singleHOCRMode = true;
      let hocrStrAll = await readOcrFile(hocrFilesAll[0]);

      // Check whether input is Abbyy XML
      const node2 = hocrStrAll.match(/\>([^\>]+)/)[1];
      abbyyMode = /abbyy/i.test(node2) ? true : false;

      if (abbyyMode) {

        hocrStrPages = hocrStrAll.replace(/[\s\S]*?(?=\<page)/i, "");
        hocrArrPages = hocrStrPages.split(/(?=\<page)/);
      } else {

        // Check if re-imported from an earlier session (and therefore containing font metrics pre-calculated)
        inputDataModes.resumeMode = /\<meta name\=[\"\']font-metrics[\"\']/i.test(hocrStrAll);

        if (inputDataModes.resumeMode) {
          let fontMetricsStr = hocrStrAll.match(/\<meta name\=[\"\']font\-metrics[\"\'][^\<]+/i)[0];
          let contentStr = fontMetricsStr.match(/content\=[\"\']([\s\S]+?)(?=[\"\']\/?\>)/i)[1].replace(/&quot;/g, '"');
          globalThis.fontMetricsObj = JSON.parse(contentStr);

        }

        hocrStrStart = hocrStrAll.match(/[\s\S]*?\<body\>/)[0];
        hocrStrEnd = hocrStrAll.match(/\<\/body\>[\s\S]*$/)[0];
        hocrStrPages = hocrStrAll.replace(/[\s\S]*?\<body\>/, "");
        hocrStrPages = hocrStrPages.replace(/\<\/body\>[\s\S]*$/, "");
        hocrStrPages = hocrStrPages.trim();

        hocrArrPages = hocrStrPages.split(/(?=\<div class\=[\'\"]ocr_page[\'\"])/);
      }

      pageCountHOCR = hocrArrPages.length;
      if (inputDataModes.imageMode && hocrArrPages.length != imageFilesAll.length) {
        throw new Error('Detected ' + hocrArrPages.length + ' pages in OCR but ' + imageFilesAll.length + " image files.")
      }
      window.hocrCurrentRaw = Array(pageCountHOCR);
      for (let i = 0; i < pageCountHOCR; i++) {
        window.hocrCurrentRaw[i] = hocrStrStart + hocrArrPages[i] + hocrStrEnd;
      }

    } else {
      const singleHOCRMode = false;
      pageCountHOCR = hocrFilesAll.length;

      // Check whether input is Abbyy XML using the first file
      let hocrStrFirst = await readOcrFile(hocrFilesAll[0]);
      const node2 = hocrStrFirst.match(/\>([^\>]+)/)[1];
      abbyyMode = /abbyy/i.test(node2) ? true : false;
    }

    // Enable confidence threshold input boxes (only used for Tesseract)
    if (!abbyyMode) {
      confThreshHighElem.disabled = false;
      confThreshMedElem.disabled = false;
      confThreshHighElem.value = "85";
      confThreshMedElem.value = "75";
    }

  }

  // If both OCR data and image data are present, confirm they have the same number of pages
  if (xmlModeImport && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    if (pageCountImage != pageCountHOCR) {
      document.getElementById("pageMismatchAlertText").textContent = " Page mismatch detected. Image data has " + pageCountImage + " pages while OCR data has " + pageCountHOCR + " pages."
      document.getElementById("pageMismatchAlert").setAttribute("style", "");
    }
  }

  pageCount = pageCountImage ?? pageCountHOCR;

  globalThis.hocrCurrent = Array(pageCount);
  globalThis.hocrCurrentRaw = globalThis.hocrCurrentRaw || Array(pageCount);
  globalThis.imageAll = Array(pageCount);
  globalThis.imageAllBinary = Array(pageCount);
  globalThis.imageAllBinaryRotated = Array(pageCount);
  inputDataModes.xmlMode = new Array(pageCount);
  if (xmlModeImport) {
    inputDataModes.xmlMode.fill(true);
  } else {
    inputDataModes.xmlMode.fill(false);
  }

  if (inputDataModes.pdfMode) {
    globalThis.imageAllColor = Array(pageCount);
  }


  if (inputDataModes.pdfMode && !xmlModeImport) {
    renderPageQueue(0);
  }

  let imageN = -1;
  let hocrN = -1;
  let firstImg = true;

  loadCountHOCR = 0;

  // Both OCR data and individual images (.png or .jpeg) contribute to the import loading bar
  // PDF files do not, as PDF files are not processed page-by-page at the import step.
  if (inputDataModes.imageMode || xmlModeImport) {
    const progressMax = inputDataModes.imageMode && xmlModeImport ? pageCount * 2 : pageCount;
    convertPageWorker["activeProgress"] = initializeProgress("import-progress-collapse", progressMax);
  }

  for (let i = 0; i < pageCount; i++) {

    // Note: As of Jan 22, exporting PDFs using BMP files is currently bugged in pdfKit (the colors channels can get switched)
    if (inputDataModes.imageMode) {

      const imageNi = imageN + 1;
      imageN = imageN + 1;

      const image = document.createElement('img');

      // Render to screen after first image is loaded
      if (firstImg) {
        image.onload = function () {
          renderPageQueue(0);
        }
        firstImg = false;
      }

      const reader = new FileReader();
      reader.addEventListener("load", () => {
        image.src = reader.result;

        imageAll[imageNi] = image;

        loadCountHOCR = loadCountHOCR + 1;
        const valueMax = parseInt(convertPageWorker["activeProgress"].getAttribute("aria-valuemax"));
        convertPageWorker["activeProgress"].setAttribute("aria-valuenow", loadCountHOCR);
        if (loadCountHOCR % 5 == 0 || loadCountHOCR == valueMax) {
          convertPageWorker["activeProgress"].setAttribute("style", "width: " + (loadCountHOCR / valueMax) * 100 + "%");
          if (loadCountHOCR == valueMax) {
            globalThis.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
            calculateOverallPageMetrics();
          }
        }

      }, false);

      reader.readAsDataURL(imageFilesAll[i]);

    }

    if (xmlModeImport) {
      toggleEditButtons(false);
      // Process HOCR using web worker, reading from file first if that has not been done already
      if (singleHOCRMode) {
        //convertPageWorker.postMessage([window.hocrCurrentRaw[i], i, abbyyMode]);
        convertPage([window.hocrCurrentRaw[i], i, abbyyMode, undefined, undefined, undefined]).then(() => updateConvertPageCounter());
      } else {
        const hocrFile = hocrFilesAll[i];
        const hocrNi = hocrN + 1;
        hocrN = hocrN + 1;
        //readOcrFile(hocrFile).then((x) => convertPageWorker.postMessage([x, hocrNi]));
        readOcrFile(hocrFile).then((x) => convertPage([x, i, undefined, undefined, undefined, undefined]).then(() => updateConvertPageCounter()));
      }
    }

  }

  // Render first handful of pages for pdfs so the interface starts off responsive
  // In the case of OCR data, this step is triggered elsewhere after all the data loads
  if (inputDataModes.pdfMode && !xmlModeImport) {
    renderPDFImageCache([...Array(Math.min(pageCount, 5)).keys()]);
  }

  // Enable downloads now for pdf imports if no HOCR data exists
  if (inputDataModes.pdfMode && !xmlModeImport) {
    downloadElem.disabled = false;
  }

  pageNumElem.value = "1";
  pageCountElem.textContent = pageCount;

}

// Scheduler for compressing PNG data
async function initMuPDFScheduler(file, workers = 3) {
  window.muPDFScheduler = Tesseract.createScheduler();
  muPDFScheduler["pngRenderCount"] = 0;
  for (let i = 0; i < workers; i++) {
    const w = await initMuPDFWorker();
    const fileData = await file.arrayBuffer();
    const pdfDoc = await w.openDocument(fileData, file.name);
    w["pdfDoc"] = pdfDoc;

    w.id = `png-${Math.random().toString(16).slice(3, 8)}`;
    muPDFScheduler.addWorker(w);
  }
}

async function loadImage(url, elem) {
  return new Promise((resolve, reject) => {
    elem.onload = () => resolve(elem);
    elem.onerror = reject;
    elem.src = url;
  });
}

export async function displayImage(n, image, binary = false) {
  if (currentPage.n == n && !(colorModeElem.value == "binary" && !binary)) {
    currentPage.renderStatus = currentPage.renderStatus + 1;

    if (!inputDataModes.xmlMode[n]) {
      let widthRender = image.width;
      let heightRender = image.height;

      if (!(image.width > 0 && image.height > 0)) {
        debugger;
      }

      let widthDisplay = Math.min(widthRender, parseFloat(zoomInputElem.value));
      let heightDisplay = Math.min(heightRender, heightRender * (widthDisplay / widthRender));

      globalThis.canvas.clear();
      globalThis.canvas.__eventListeners = {};

      globalThis.canvas.setHeight(heightDisplay);
      globalThis.canvas.setWidth(widthDisplay);

      globalThis.canvas.setZoom(widthDisplay / widthRender);

    }

    currentPage.backgroundImage = new fabric.Image(image, { objectCaching: false });
    selectDisplayMode(displayModeElem.value);
  }
}


// Function that renders images and stores them in cache array (or returns early if the requested image already exists).
// The color OR grayscale version is stored in imageAll, while the binary image is stored in imageAllBinary.
async function renderPDFImageCache(pagesArr, rotateBinary = null) {

  const colorMode = colorModeElem.value;

  await Promise.allSettled(pagesArr.map(async (n) => {

    // Whether the non-binary (color or grayscale) image needs to be rendered.
    const renderImage = inputDataModes.pdfMode && (!globalThis.imageAll[n] || (colorMode != "binary" && globalThis.imageAllColor[n] != colorMode)) ? true : false;

    if (renderImage) {

      globalThis.imageAllColor[n] = colorModeElem.value;
      imageAll[n] = new Promise(async function (resolve, reject) {

        // Initialize scheduler if one does not already exist
        // This happens when the original scheduler is killed after all pages are rendered,
        // but then the user changes from color to grayscale (or vice versa).
        await initSchedulerIfNeeded("muPDFScheduler");

        // Render to 300 dpi by default
        let dpi = 300;

        // When XML data exists, render to the size specified by that
        if (inputDataModes.xmlMode[n]) {
          const imgWidthXml = globalThis.pageMetricsObj["dimsAll"][n][1];
          const imgWidthPdf = await muPDFScheduler.addJob('pageWidth', [n + 1, 300]);
          if (imgWidthPdf != imgWidthXml) {
            dpi = Math.round(300 * (imgWidthXml / imgWidthPdf));
          }

          // Otherwise, confirm that 300 dpi leads to a reasonably sized image and lower dpi if not.
          // For reasons that are unclear, a small number of pages have been rendered into massive files
          // so a hard-cap on resolution must be imposed.
        } else {
          const imgWidthPdf = await muPDFScheduler.addJob('pageWidth', [n + 1, 300]);
          if (imgWidthPdf > 2000) {
            dpi = Math.round(300 * (2000 / imgWidthPdf));
          }
        }

        // When XML data exists, render to the size specified by that
        if (inputDataModes.xmlMode[n]) {
          const imgWidthXml = globalThis.pageMetricsObj["dimsAll"][n][1];
          const imgWidthPdf = await muPDFScheduler.addJob('pageWidth', [n + 1, 300]);
          if (imgWidthPdf != imgWidthXml) {
            dpi = Math.round(300 * (imgWidthXml / imgWidthPdf));
          }
        }

        const useColor = colorMode == "color" ? true : false;

        const res = await muPDFScheduler.addJob('drawPageAsPNG', [n + 1, dpi, useColor]);

        const image = document.createElement('img');
        await loadImage(res, image);

        resolve(image);

        await displayImage(n, image);

      });
    }


    // Whether the binary image needs to be rendered.
    let renderImageBinary = !globalThis.imageAllBinary[n] && colorMode == "binary" ? true : false;

    // Whether the binary image should be rotated
    rotateBinary = rotateBinary ?? true;
    const angleArg = rotateBinary ? pageMetricsObj["angleAll"][n] * (Math.PI / 180) * -1 || 0 : 0;


    // By default binary images are not re-rendered with a different rotation setting.
    // This behavior can be changed by setting `rotate` to true or false.
    //if (colorMode == "binary" && [true, false].includes(rotateBinary) && rotateBinary != window.imageAllBinaryRotated[n]) {
    if (colorMode == "binary" && Math.abs(pageMetricsObj["angleAll"][n]) > 0.05 && (Boolean(angleArg) == true && window.imageAllBinaryRotated[n] == false || rotateBinary == false && window.imageAllBinaryRotated[n] == true)) {
      renderImageBinary = true;
    }

    if (renderImageBinary) {



      window.imageAllBinaryRotated[n] = Boolean(angleArg);
      imageAllBinary[n] = new Promise(async function (resolve, reject) {

        await initSchedulerIfNeeded("binaryScheduler");

        const image = document.createElement('img');
        //const res = await binaryScheduler.addJob("threshold", globalThis.imageAll[n].src, { angle: 0.15 });

        const inputImage = await window.imageAll[n];

        const res = await binaryScheduler.addJob("threshold", inputImage.src, { angle: angleArg });
        await loadImage(res.data, image);
        //window.imageAllBinary[n] = image;
        resolve(image);

        await displayImage(n, image, true);

      });
    }
  }));

}



//var backgroundOpts = new Object;
// Function that handles page-level info for rendering to canvas and pdf
export async function renderPageQueue(n, mode = "screen", loadXML = true, lineMode = false, dimsLimit = null) {

  // Return if data is not loaded yet
  const imageMissing = inputDataModes.imageMode && (imageAll.length == 0 || imageAll[n] == null || imageAll[n].complete != true) || inputDataModes.pdfMode && (typeof (muPDFScheduler) == "undefined");
  const xmlMissing =  globalThis.hocrCurrent.length == 0 || typeof (globalThis.hocrCurrent[n]) != "string";
  if (imageMissing && (inputDataModes.imageMode || inputDataModes.pdfMode) || xmlMissing && inputDataModes.xmlMode[n]) {
    console.log("Exiting renderPageQueue early");
    return;
  }

  // Parse the relevant XML (relevant for both Canvas and PDF)
  if (loadXML && inputDataModes.xmlMode[n] && globalThis.hocrCurrent[n]) {
    // Compare selected text to ground truth in eval mode
    if (displayModeElem.value == "eval") {
      console.time();
      compareGroundTruthClick(n);
      console.timeEnd();
    }
    currentPage.xmlDoc = parser.parseFromString(globalThis.hocrCurrent[n], "text/xml");
  } else if (!inputDataModes.xmlMode[n]) {
    currentPage.xmlDoc = null;
  }

  // Determine image size and canvas size
  let imgDims = null;
  let canvasDims = null;

  // In the case of a pdf with no ocr data and no cached png, no page size data exists yet.
  if (!(inputDataModes.pdfMode && !inputDataModes.xmlMode[n] && (typeof (imageAll[n]) == "undefined"))) {
    imgDims = new Array(2);
    canvasDims = new Array(2);

    // Get image dimensions from OCR data if present; otherwise get dimensions of images directly
    if (inputDataModes.xmlMode[n]) {
      imgDims[1] = globalThis.pageMetricsObj["dimsAll"][n][1];
      imgDims[0] = globalThis.pageMetricsObj["dimsAll"][n][0];
    } else {
      const backgroundImage = await imageAll[n];
      imgDims[1] = backgroundImage.width;
      imgDims[0] = backgroundImage.height;
    }

    // The canvas size and image size are generally the same.
    // The exception is when rendering a pdf with the "standardize page size" option on,
    // which will scale the canvas size but not the image size.
    if (mode == "pdf" && dimsLimit[0] > 0 && dimsLimit[1] > 0) {
      canvasDims[1] = dimsLimit[1];
      canvasDims[0] = dimsLimit[0];
    } else {
      canvasDims[1] = imgDims[1];
      canvasDims[0] = imgDims[0];
    }
  }

  // Calculate options for background image and overlay
  if (inputDataModes.xmlMode[n]) {

    currentPage.backgroundOpts.originX = "center";
    currentPage.backgroundOpts.originY = "center";

    currentPage.backgroundOpts.left = imgDims[1] * 0.5;
    currentPage.backgroundOpts.top = imgDims[0] * 0.5;


    let marginPx = Math.round(canvasDims[1] * leftGlobal);
    if (autoRotateCheckboxElem.checked) {
      currentPage.backgroundOpts.angle = globalThis.pageMetricsObj["angleAll"][n] * -1 ?? 0;

    } else {
      currentPage.backgroundOpts.angle = 0;
    }

    // TODO: Create a more efficient implementation of "show margin" feature
    if (showMarginCheckboxElem.checked && mode == "screen") {
      canvas.viewportTransform[4] = 0;

      canvas.clear();

      if (imgDims != null) {
        let zoomFactor = Math.min(parseFloat(/** @type {HTMLInputElement} */(document.getElementById('zoomInput')).value) / imgDims[1], 1);
        canvas.setHeight(imgDims[0] * zoomFactor);
        canvas.setWidth(imgDims[1] * zoomFactor);
        canvas.setZoom(zoomFactor);
      }

      let marginLine = new fabric.Line([marginPx, 0, marginPx, canvasDims[0]], { stroke: 'blue', strokeWidth: 1, selectable: false, hoverCursor: 'default' });
      canvas.add(marginLine);

      let marginImage = canvas.toDataURL();
      canvas.clear();
      canvas.setOverlayImage(marginImage, canvas.renderAll.bind(canvas), {
        overlayImageLeft: 100,
        overlayImageTop: 100
      });

    }

    currentPage.leftAdjX = 0;
    if (autoMarginCheckboxElem.checked && leftGlobal != null) {

      // Adjust page to match global margin unless it would require large transformation (likely error)
      if (globalThis.pageMetricsObj["leftAll"][n] > 0 && Math.abs(marginPx - globalThis.pageMetricsObj["leftAll"][n]) < (globalThis.pageMetricsObj["dimsAll"][currentPage.n][1] / 3)) {
        currentPage.leftAdjX = marginPx - globalThis.pageMetricsObj["leftAll"][n];
      }

      if (autoRotateCheckboxElem.checked) {
        const sinAngle = Math.sin(globalThis.pageMetricsObj["angleAll"][n] * (Math.PI / 180));
        const shiftX = sinAngle * (imgDims[0] * 0.5) * -1 || 0;

        currentPage.leftAdjX = currentPage.leftAdjX - shiftX - (globalThis.pageMetricsObj["angleAdjAll"][n] ?? 0);
      }

      currentPage.backgroundOpts.left = imgDims[1] * 0.5 + currentPage.leftAdjX;
    } else {
      currentPage.backgroundOpts.left = imgDims[1] * 0.5;
    }

    if (mode == "screen") {
      canvas.viewportTransform[4] = globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
    }

  }

  if (mode == "screen") {
    // Clear canvas if objects (anything but the background) exists
    if (canvas.getObjects().length) {
      canvas.clear()
      canvas.__eventListeners = {};
    }

    if (imgDims != null) {
      let zoomFactor = Math.min(parseFloat(/** @type {HTMLInputElement} */(document.getElementById('zoomInput')).value) / imgDims[1], 1);
      canvas.setHeight(imgDims[0] * zoomFactor);
      canvas.setWidth(imgDims[1] * zoomFactor);
      canvas.setZoom(zoomFactor);
    }

    currentPage.renderStatus = 0;

    //const colorMode = colorModeElem.value;

    renderPDFImageCache([n], true);
    const backgroundImage = colorModeElem.value == "binary" ? await imageAllBinary[n] : await imageAll[n];
    currentPage.backgroundImage = new fabric.Image(backgroundImage, { objectCaching: false });
    currentPage.renderStatus = currentPage.renderStatus + 1;
    selectDisplayMode(displayModeElem.value);

    // If there is no OCR data to render, we are done
    if (!inputDataModes.xmlMode[n]) {
      return;
    }

  } else {
    globalThis.doc.addPage({ size: [canvasDims[1], canvasDims[0]], margin: 0 });

    if (displayModeElem.value != "ebook") {

      const backgroundImage = colorModeElem.value == "binary" ? await imageAllBinary[n] : await imageAll[n];
      globalThis.doc.image(backgroundImage.src, currentPage.leftAdjX, 0, { align: 'left', valign: 'top' });

    }
  }

  if (mode == "screen") {
    await renderPage(canvas, null, currentPage.xmlDoc, "screen", globalSettings.defaultFont, lineMode, imgDims, canvasDims, globalThis.pageMetricsObj["angleAll"][n], inputDataModes.pdfMode, fontObj, currentPage.leftAdjX);
    if (currentPage.n == n) {
      currentPage.renderStatus = currentPage.renderStatus + 1;
    }
    await selectDisplayMode(displayModeElem.value);
  } else if (inputDataModes.xmlMode[n]) {
    await renderPage(canvas, doc, currentPage.xmlDoc, "pdf", globalSettings.defaultFont, lineMode, imgDims, canvasDims, globalThis.pageMetricsObj["angleAll"][n], inputDataModes.pdfMode, fontObj, currentPage.leftAdjX);
  }

}

var cacheMode = true;
var cachePages = 3;

var working = false;
async function onPrevPage(marginAdj) {
  if (currentPage.n + 1 <= 1 || working) {
    return;
  }
  working = true;
  if (inputDataModes.xmlMode[currentPage.n]) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }

  currentPage.n = currentPage.n - 1;
  pageNumElem.value = (currentPage.n + 1).toString();

  rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;

  await renderPageQueue(currentPage.n);

  // Render 1 page back
  if (inputDataModes.pdfMode && cacheMode) {
    const nMax = parseInt(pageCountElem.textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i * -1 + currentPage.n - 1).filter(x => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
  }


  working = false;
}




async function onNextPage() {
  if (currentPage.n + 1 >= globalThis.hocrCurrent.length || working) {
    return;
  }
  working = true;
  if (inputDataModes.xmlMode[currentPage.n]) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }

  currentPage.n = currentPage.n + 1;
  pageNumElem.value = (currentPage.n + 1).toString();

  rangeLeftMarginElem.value = 200 + globalThis.pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;
  canvas.viewportTransform[4] = pageMetricsObj["manAdjAll"][currentPage.n] ?? 0;

  await renderPageQueue(currentPage.n);

  // Render 1 page ahead
  if (inputDataModes.pdfMode && cacheMode) {
    const nMax = parseInt(pageCountElem.textContent);
    const cacheArr = [...Array(cachePages).keys()].map(i => i + currentPage.n + 1).filter(x => x < nMax && x >= 0);
    if (cacheArr.length > 0) {
      renderPDFImageCache(cacheArr);
    }
  }

  working = false;
}


async function optimizeFontClick(value) {
  if (inputDataModes.xmlMode[currentPage.n]) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }
  if (value) {
    await optimizeFont2();
  } else {
    await loadFontFamily(globalSettings.defaultFont, globalThis.fontMetricsObj);

  }
  renderPageQueue(currentPage.n);
}

window["binarySchedulerInit"] = async function () {
  // Workers take a non-trivial amount of time to started so a tradeoff exists with how many to use.
  // Using 1 scheduler per 4 pages as a quick fix--have not benchmarked optimal number.
  const n = Math.min(Math.ceil(imageAll.length / 4), 4);
  window["binaryScheduler"] = await createTesseractScheduler(n);
  return;
}

window["muPDFSchedulerInit"] = async function () {
  await initMuPDFScheduler(window.pdfFile, 3);
  if (window.imageAll) {
    // TODO: Fix to work with promises
    window["muPDFScheduler"]["pngRenderCount"] = 0;
    //window["muPDFScheduler"]["pngRenderCount"] = [...Array(imageAll.length).keys()].filter((x) => typeof (imageAll[x]) == "object" && (colorModeElem.value == "binary" || imageAllColor[x] == colorModeElem.value)).length;
  } else {
    window["muPDFScheduler"]["pngRenderCount"] = 0;
  }

  return;
}

// Function that is invoked before a scheduler is used.
// If the scheduler already exists, resolves immediately.
// If scheduler is being created already, return promise that resolves when that is done.
// If scheduler does not exist and is not being created, initialize and return promise that resolves when done.
async function initSchedulerIfNeeded(x) {
  if (window[x] && typeof (window[x]) == "object") {
    return;
  } else if (window[x] == true) {
    await new Promise(function (resolve, reject) {
      window[x + "Loaded"] = resolve;
    });
    return;
  } else {
    window[x] = true;
    await window[x + "Init"]();
    if (window[x + "Loaded"]) window[x + "Loaded"]();
    return;
  }
}

async function renderPDF() {

  globalThis.doc = new PDFDocument({
    margin: 0,
    autoFirstPage: false
  });

  const stream = globalThis.doc.pipe(blobStream());

  let fontObjData = new Object;
  //TODO: Edit so that only fonts used in the document are inserted into the PDF.
  for (const [familyKey, familyObj] of Object.entries(fontObj)) {
    if (typeof (fontObjData[familyKey]) == "undefined") {
      fontObjData[familyKey] = new Object;
    }

    for (const [key, value] of Object.entries(familyObj)) {

      if (key == "small-caps") {
        //Note: pdfkit has a bug where fonts with spaces in the name create corrupted files (they open in browser but not Adobe products)
        //Taking all spaces out of font names as a quick fix--this can likely be removed down the line if patched.
        //https://github.com/foliojs/pdfkit/issues/1314

        fontObj[familyKey][key].tables.name.postScriptName["en"] = globalSettings.defaultFont + "-SmallCaps";
        fontObj[familyKey][key].tables.name.fontSubfamily["en"] = "SmallCaps";
        fontObj[familyKey][key].tables.name.postScriptName["en"] = fontObj[familyKey][key].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

        fontObjData[familyKey][key] = fontObj[familyKey][key].toArrayBuffer();
      // if (key == "small-caps" && optimizeFontElem.checked && familyKey == globalSettings.defaultFont) {
      //   fontObjData[familyKey][key] = fontDataOptimizedSmallCaps;
      } else if (key == "normal" && optimizeFontElem.checked && familyKey == globalSettings.defaultFont) {
        fontObjData[familyKey][key] = fontDataOptimized;
      } else if (key == "italic" && optimizeFontElem.checked && familyKey == globalSettings.defaultFont) {
        fontObjData[familyKey][key] = fontDataOptimizedItalic;
      } else {
        fontObj[familyKey][key].tables.name.postScriptName["en"] = fontObj[familyKey][key].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");
        fontObjData[familyKey][key] = fontObj[familyKey][key].toArrayBuffer();
      }


      globalThis.doc.registerFont(familyKey + "-" + key, fontObjData[familyKey][key]);
    }
  }


  let minValue = parseInt(pdfPageMinElem.value);
  let maxValue = parseInt(pdfPageMaxElem.value);

  let pagesArr = [...Array(maxValue - minValue + 1).keys()].map(i => i + minValue - 1);

  // Render all pages to PNG
  if (inputDataModes.pdfMode && displayModeElem.value != "ebook") {

    // TODO: Fix to work with promises
    const pngRenderCount = 0;
    //const pngRenderCount = [...Array(imageAll.length).keys()].filter((x) => typeof (imageAll[x]) == "object" && (colorModeElem.value == "binary" || imageAllColor[x] == colorModeElem.value)).length;
    if (pngRenderCount < imageAll.length) {

      await initSchedulerIfNeeded("muPDFScheduler");

    }
  }
  if (colorModeElem.value == "binary" && displayModeElem.value != "ebook") {

      await initSchedulerIfNeeded("binaryScheduler");

  }

  await renderPDFImageCache(pagesArr, autoRotateCheckboxElem.checked);


  let standardizeSizeMode = document.getElementById("standardizeCheckbox").checked;
  let dimsLimit = new Array(maxValue - minValue + 1);
  dimsLimit.fill(0);
  if (standardizeSizeMode) {
    for (let i = (minValue - 1); i < maxValue; i++) {
      dimsLimit[0] = Math.max(dimsLimit[0], globalThis.pageMetricsObj["dimsAll"][i][0]);
      dimsLimit[1] = Math.max(dimsLimit[1], globalThis.pageMetricsObj["dimsAll"][i][1]);
    }
  }

  const downloadProgress = initializeProgress("generate-download-progress-collapse", maxValue);

  for (let i = (minValue - 1); i < maxValue; i++) {

    await renderPageQueue(i, "pdf", true, false, dimsLimit);

    // Update progress bar
    if ((i + 1) % 5 == 0 || (i + 1) == maxValue) {
      downloadProgress.setAttribute("aria-valuenow", (i + 1).toString());
      downloadProgress.setAttribute("style", "width: " + ((i + 1) / maxValue * 100) + "%");
      await sleep(0);

    }

  }

  globalThis.doc.end();
  stream.on('finish', function () {
    // get a blob you can do whatever you like with

    // Note: Do not specify pdf MIME type.
    // Due to a recent Firefox update, this causes the .pdf to be opened in the same tab (replacing the main site)
    // https://support.mozilla.org/en-US/kb/manage-downloads-preferences-using-downloads-menu

    //let url = stream.toBlobURL('application/pdf');
    let url = stream.toBlobURL();
    let fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".pdf";

    saveAs(url, fileName);

  });

  // Quick fix to avoid issues where the last page rendered would be mistaken for the last page on screen
  renderPageQueue(currentPage.n);

}


// TODO: Rework storage of optimized vs. non-optimized fonts to be more organized
var fontDataOptimized, fontDataOptimizedItalic, fontDataOptimizedSmallCaps;

export async function optimizeFont2() {


  fontObj[globalSettings.defaultFont]["normal"].tables.gsub = null;
  fontObj[globalSettings.defaultFont]["italic"].tables.gsub = null;

  // Quick fix due to bug in pdfkit (see note in renderPDF function)
  fontObj[globalSettings.defaultFont]["normal"].tables.name.postScriptName["en"] = fontObj[globalSettings.defaultFont]["normal"].tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

  let fontArr = await optimizeFont(fontObj[globalSettings.defaultFont]["normal"], fontObj[globalSettings.defaultFont]["italic"], globalThis.fontMetricsObj["normal"]);

  fontDataOptimized = fontArr[0].toArrayBuffer();
  await loadFont(globalSettings.defaultFont, fontDataOptimized, true);

  fontDataOptimizedItalic = fontArr[1].toArrayBuffer();
  await loadFont(globalSettings.defaultFont + "-italic", fontDataOptimizedItalic, true);

  // Create small caps font using optimized "normal" font as a starting point
  //createSmallCapsFont(window.fontObj["Libre Baskerville"]["normal"], "Libre Baskerville", fontMetricsObj["heightSmallCaps"] || 1, fontMetricsObj);

  // Optimize small caps if metrics exist to do so
  if (globalThis.fontMetricsObj["small-caps"]) {
    fontArr = await optimizeFont(fontObj[globalSettings.defaultFont]["small-caps"], null, globalThis.fontMetricsObj["small-caps"]);
    fontDataOptimizedSmallCaps = fontArr[0].toArrayBuffer();
    const kerningPairs = JSON.parse(JSON.stringify(fontArr[0].kerningPairs));
    await loadFont(globalSettings.defaultFont + "-small-caps", fontDataOptimizedSmallCaps, true);
    fontObj[globalSettings.defaultFont]["small-caps"].kerningPairs = kerningPairs;
    //await loadFont(globalSettings.defaultFont + " Small Caps", fontDataOptimizedSmallCaps, true);
  }

  // Optimize italics if metrics exist to do so
  if (globalThis.fontMetricsObj["italic"]) {
    fontArr = await optimizeFont(fontObj[globalSettings.defaultFont]["italic"], null, globalThis.fontMetricsObj["italic"], "italic");
    fontDataOptimizedItalic = fontArr[0].toArrayBuffer();
    await loadFont(globalSettings.defaultFont + "-italic", fontDataOptimizedItalic, true);
  }


}


var convertPageWorker = new Worker('js/convertPage.js');
convertPageWorker.promises = {};
convertPageWorker.promiseId = 0;


function convertPage(args) {

  return new Promise(function (resolve, reject) {
    let id = convertPageWorker.promiseId++;
    convertPageWorker.promises[id] = { resolve: resolve };

    args.push(id);

    convertPageWorker.postMessage(args);

  });

}

function updateConvertPageCounter() {

  let activeProgress = convertPageWorker["activeProgress"];

  loadCountHOCR = loadCountHOCR + 1;
  activeProgress.setAttribute("aria-valuenow", loadCountHOCR);

  const valueMax = parseInt(activeProgress.getAttribute("aria-valuemax"));

  // Update progress bar between every 1 and 5 iterations (depending on how many pages are being processed).
  // This can make the interface less jittery compared to updating after every loop.
  // The jitter issue will likely be solved if more work can be offloaded from the main thread and onto workers.
  const updateInterval = Math.min(Math.ceil(valueMax / 10), 5);
  if (loadCountHOCR % updateInterval == 0 || loadCountHOCR == valueMax) {
    activeProgress.setAttribute("style", "width: " + (loadCountHOCR / valueMax) * 100 + "%");
    if (loadCountHOCR == valueMax) {
      // If resuming from a previous editing session font stats are already calculated
      if (!inputDataModes.resumeMode) {
        // Buttons are enabled from calculateOverallFontMetrics function in this case
        globalThis.fontMetricsObj = calculateOverallFontMetrics(fontMetricObjsMessage);
      } else {
        optimizeFontElem.disabled = false;
        downloadElem.disabled = false;
        //recognizeAllElem.disabled = true;
      }
      calculateOverallPageMetrics();
      // Render first handful of pages for pdfs so the interface starts off responsive
      if (inputDataModes.pdfMode) {
        renderPDFImageCache([...Array(Math.min(valueMax, 5)).keys()]);
      }

    }
  }
}

convertPageWorker.onmessage = function (e) {

  const recognizeAreaMode = e.data[2];

  const oemText = e.data[3];
  const oemCurrent = !oemText || oemText == document.getElementById("displayLabelText").innerHTML ? true : false;

  // If an OEM engine is specified, save to the appropriate object within hocrAll,
  // and only set to hocrCurrent if appropriate.  This prevents "Recognize All" from
  // overwriting the wrong output if a user switches hocrCurrent to another OCR engine
  // while the recognition job is running.
  if (oemText) {
    globalThis.hocrAll[e.data[3]][e.data[1]] = e.data[0][0] || "<div class='ocr_page'></div>";
    if (oemCurrent) {
      globalThis.hocrCurrent[e.data[1]] = e.data[0][0] || "<div class='ocr_page'></div>";
    }
  } else {
    globalThis.hocrCurrent[e.data[1]] = e.data[0][0] || "<div class='ocr_page'></div>";
  }

  // When using the "Recognize Area" feature the XML dimensions will be smaller than the page dimensions
  if (recognizeAreaMode) {
    globalThis.pageMetricsObj["dimsAll"][e.data[1]] = [currentPage.backgroundImage.height, currentPage.backgroundImage.width];
    globalThis.hocrCurrent[e.data[1]] = globalThis.hocrCurrent[e.data[1]].replace(/bbox( \d+)+/, "bbox 0 0 " + currentPage.backgroundImage.width + " " + currentPage.backgroundImage.height);
  } else {
    globalThis.pageMetricsObj["dimsAll"][e.data[1]] = e.data[0][1];
  }

  inputDataModes.xmlMode[e.data[1]] = true;

  globalThis.pageMetricsObj["angleAll"][e.data[1]] = e.data[0][2];
  globalThis.pageMetricsObj["leftAll"][e.data[1]] = e.data[0][3];
  globalThis.pageMetricsObj["angleAdjAll"][e.data[1]] = e.data[0][4];
  fontMetricObjsMessage["widthObjAll"].push(e.data[0][5]);
  fontMetricObjsMessage["heightObjAll"].push(e.data[0][6]);
  fontMetricObjsMessage["heightSmallCapsObjAll"].push(e.data[0][7]);
  fontMetricObjsMessage["cutObjAll"].push(e.data[0][8]);
  fontMetricObjsMessage["kerningObjAll"].push(e.data[0][9]);
  fontMetricObjsMessage["messageAll"][e.data[1]] = e.data[0][10];

  // If this is the page the user has open, render it to the canvas
  if (e.data[1] == currentPage.n && oemCurrent) {
    renderPageQueue(currentPage.n);
  }

  convertPageWorker.promises[e.data[e.data.length-1]].resolve();

}

function calculateOverallPageMetrics() {
  // It is possible for image resolution to vary page-to-page, so the left margin must be calculated
  // as a percent to remain visually identical between pages.
  let leftAllPer = new Array(globalThis.pageMetricsObj["leftAll"].length);
  for (let i = 0; i < globalThis.pageMetricsObj["leftAll"].length; i++) {
    leftAllPer[i] = globalThis.pageMetricsObj["leftAll"][i] / globalThis.pageMetricsObj["dimsAll"][i][1];
  }
  leftGlobal = quantile(leftAllPer, 0.5);
  globalThis.pageMetricsObj["manAdjAll"] = new Array(globalThis.pageMetricsObj["leftAll"].length);
  globalThis.pageMetricsObj["manAdjAll"].fill(0);

}

// Function to change the display mode
// Impacts text color and opacity, and backgound image opacity
globalThis.selectDisplayMode = function (x) {

  if (inputDataModes.xmlMode[currentPage.n] && inputDataModes.pdfMode && currentPage.renderStatus != 2) { return; }

  let opacity_arg, fill_arg;
  if (x == "invis") {
    opacity_arg = 0
    fill_arg = "fill_ebook"
  } else if (x == "ebook") {
    opacity_arg = 1
    fill_arg = "fill_ebook"
  } else if (x == "eval") {
    opacity_arg = 1
    fill_arg = "fill_eval"
  } else {
    opacity_arg = 1
    fill_arg = "fill_proof"
  }

  canvas.forEachObject(function (obj) {
    if (obj.type == "i-text") {
      obj.set("fill", obj.get(fill_arg));

      obj.set("opacity", opacity_arg);
    }
  });

  // Edit rotation for binary images that have already been rotated
  if (colorModeElem.value == "binary" && window.imageAllBinaryRotated[currentPage.n]) {
    if (currentPage.backgroundOpts.angle) {
      currentPage.backgroundOpts.angle = 0;
    } else {
      currentPage.backgroundOpts.angle = globalThis.pageMetricsObj["angleAll"][currentPage.n];
    }
  }

  // Include a background image if appropriate
  if (['invis', 'proof', 'eval'].includes(x) && (inputDataModes.imageMode || inputDataModes.pdfMode)) {
    canvas.setBackgroundColor("white");
    //canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas));
    canvas.setBackgroundImage(currentPage.backgroundImage, canvas.renderAll.bind(canvas), currentPage.backgroundOpts);
  } else {
    canvas.setBackgroundColor(null);
    canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas));
  }

  working = false;

}

async function handleDownload() {

  downloadElem.removeEventListener('click', handleDownload);
  downloadElem.disabled = true;

  updatePdfPagesLabel();

  // Save any edits that may exist on current page
  if (inputDataModes.xmlMode[currentPage.n]) {
    globalThis.hocrCurrent[currentPage.n] = currentPage.xmlDoc?.documentElement.outerHTML;
  }
  let download_type = document.getElementById('formatLabelText').textContent.toLowerCase();
  if (download_type == "pdf") {
    await renderPDF();
  } else if (download_type == "hocr") {
    renderHOCR(globalThis.hocrCurrent, globalThis.fontMetricsObj)
  } else if (download_type == "text") {
    renderText(globalThis.hocrCurrent)
  }

  downloadElem.disabled = false;
  downloadElem.addEventListener('click', handleDownload);
}
