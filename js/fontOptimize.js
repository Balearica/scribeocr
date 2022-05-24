
// File summary:
// Functions to calculate font metrics and generate new fonts.

import { quantile, round6 } from "./miscUtils.js";
import { loadFont } from "./fontUtils.js";

// Creates optimized version of `font` based on metrics in `fontMetricsObj`
export async function optimizeFont(font, auxFont, fontMetricsObj, type = "normal"){

    let fontData = font.toArrayBuffer();

  let workingFont = opentype.parse(fontData, { lowMemory: false });
  
  let fontDataAux, workingFontAux;
  if (auxFont) {
    fontDataAux = auxFont.toArrayBuffer();
    workingFontAux = opentype.parse(fontDataAux, { lowMemory: false });
  }
  

    let oGlyph = workingFont.charToGlyph("o").getMetrics();
    let xHeight = oGlyph.yMax - oGlyph.yMin;

    let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;

    // Define various character classes
    const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
  
    const upperAsc = ["1","4","5","7","A","B","D","E","F","H","I","K","L","M","N","P","R","T","U","V","W","X","Y","Z"]

    const singleStemClassA = ["i","l","t","I"];
    const singleStemClassB = ["f","i","j","l","t","I","J","T"];

    //const workingFontRightBearingMedian = quantile(lower.map(x => workingFont.charToGlyph(x).getMetrics().rightSideBearing), 0.5);
    //console.log("workingFontRightBearingMedian: " + workingFontRightBearingMedian);

    // Adjust character width and advance
  for (const [key, value] of Object.entries(fontMetricsObj["charWidth"])) {

      // 33 is the first latin glyph (excluding space which is 32)
      if(parseInt(key) < 33) { continue; }

      const charLit = String.fromCharCode(parseInt(key));


      // Some glyphs do not benefit from recalculating statistics, as they are commonly misidentified
      if(["."].includes(charLit)) { continue; }

      let glyphI = workingFont.charToGlyph(charLit);

      if(glyphI.name == ".notdef" || glyphI.name == "NULL") continue;

      let glyphIMetrics = glyphI.getMetrics();
      let glyphIWidth = glyphIMetrics.xMax - glyphIMetrics.xMin;
      let scaleXFactor = (value * xHeight) / glyphIWidth;


      // Left bearings are currently only changed for specific punctuation characters (overall scaling aside)
      let shiftX = 0;
      if([";",":","‘","’", "“", "”","\""].includes(charLit)){
        let leftBearingCorrect = Math.round(fontMetricsObj["cutMedian"][key] * xHeight);
        if(isFinite(leftBearingCorrect)){
          let leftBearingAct = glyphI.leftSideBearing;
          shiftX = leftBearingCorrect - leftBearingAct;

        }
      }

      // TODO: For simplicitly we assume the stem is located at the midpoint of the bounding box (0.35 for "f")
      // This is not always true (for example, "t" in Libre Baskerville).
      // Look into whether there is a low(ish) effort way of finding the visual center for real.

      let glyphICenterPoint = charLit == "f" ? 0.35 : 0.5;

      let glyphICenter = Math.max(glyphIMetrics.xMin, 0) + Math.round(glyphIWidth * glyphICenterPoint);
      let glyphIWidthQuarter = Math.round(glyphIWidth / 4);

      // Horizontal scaling is limited for certain letters with a single vertical stem.
      // This is because the bounding box for these letters is almost entirely established by the stylistic flourish.
      if(singleStemClassA.includes(charLit)){
        scaleXFactor = Math.max(Math.min(scaleXFactor, 1.1), 0.9);
      // Some fonts have significantly wider double quotes compared to the default style, so more variation is allowed
      } else if(["“", "”"].includes(charLit)){
        scaleXFactor = Math.max(Math.min(scaleXFactor, 1.5), 0.7);
      } else {
        scaleXFactor = Math.max(Math.min(scaleXFactor, 1.3), 0.7);
      }

      for(let j=0; j < glyphI.path.commands.length; j++){
        let pointJ = glyphI.path.commands[j];
        if(pointJ.x != null){
          //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          if(singleStemClassB.includes(charLit)){
            if(Math.abs(pointJ.x - glyphICenter) > glyphIWidthQuarter){
              pointJ.x = Math.round((pointJ.x - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
            }
          } else {
            pointJ.x = Math.round(pointJ.x * scaleXFactor) + shiftX;
          }

        }
        if(pointJ.x1 != null){
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          if(singleStemClassB.includes(charLit)){
            if(Math.abs(pointJ.x1 - glyphICenter) > glyphIWidthQuarter){
              pointJ.x1 = Math.round((pointJ.x1 - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
            }
          } else {
            pointJ.x1 = Math.round(pointJ.x1 * scaleXFactor) + shiftX;
          }
        }
        if(pointJ.x2 != null){
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          if(singleStemClassB.includes(charLit)){
            if(Math.abs(pointJ.x2 - glyphICenter) > glyphIWidthQuarter){
              pointJ.x2 = Math.round((pointJ.x2 - glyphICenter) * scaleXFactor) + glyphICenter + shiftX;
            }
          } else {
            pointJ.x2 = Math.round(pointJ.x2 * scaleXFactor) + shiftX;
          }
        }


      }
    
      // Do not adjust advance for italic "f".
      if (key == "102" && type == "italic") continue;


      glyphIMetrics = glyphI.getMetrics();

      // To simplify calculations, no right bearings are used.
      //glyphI.advanceWidth = Math.round(scaleXFactor * glyphIWidth) + glyphIMetrics.xMin;
      glyphI.advanceWidth = glyphIMetrics.xMax;
      glyphI.leftSideBearing = glyphIMetrics.xMin;
      //glyphI.rightSideBearing = 0;


    }

    // Adjust character height
  const capsMult = xHeight * fontMetricsObj["heightCaps"] / fontAscHeight;
  for (const [key, value] of Object.entries(fontMetricsObj["charHeight"])) {
    
      // 33 is the first latin glyph (excluding space which is 32)
      if(parseInt(key) < 33) { continue; }

      const charLit = String.fromCharCode(parseInt(key));

      // Currently only capital letters that start (approximately) at the baseline have their height adjusted.
      //if(/[^A-Z]/.test(charLit) || ["J","Q"].includes(charLit)) { continue; }
      if(/[^A-Z]/.test(charLit)) { continue; }

      let glyphI = workingFont.charToGlyph(charLit);
      

      let glyphIMetrics = glyphI.getMetrics();
      //let glyphIHeight = glyphIMetrics.yMax - glyphIMetrics.yMin;
      //let scaleYFactor = (value * xHeight) / glyphIHeight;

      //scaleYFactor = Math.max(Math.min(scaleYFactor, 1.3), 0.7);

      for(let j=0; j < glyphI.path.commands.length; j++){
        let pointJ = glyphI.path.commands[j];
        if(pointJ.y != null){
          //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y = Math.round(pointJ.y * capsMult);
        }
        if(pointJ.y1 != null){
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y1 = Math.round(pointJ.y1 * capsMult);
        }
        if(pointJ.y2 != null){
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y2 = Math.round(pointJ.y2 * capsMult);
        }

      }

    if (auxFont) {
      let glyphI2 = workingFontAux.charToGlyph(charLit);
      for (let j = 0; j < glyphI2.path.commands.length; j++) {
        let pointJ = glyphI2.path.commands[j];
        if (pointJ.y != null) {
          //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y = Math.round(pointJ.y * capsMult);
        }
        if (pointJ.y1 != null) {
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y1 = Math.round(pointJ.y1 * capsMult);
        }
        if (pointJ.y2 != null) {
          //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
          pointJ.y2 = Math.round(pointJ.y2 * capsMult);
        }
      }
    }
  }

  const upperAscCodes = upperAsc.map((x) => String(x.charCodeAt(0)));
  const charHeightKeys = Object.keys(fontMetricsObj["charHeight"]);
  const charHeightA = round6(quantile(Object.values(fontMetricsObj["charHeight"]).filter((element, index) => upperAscCodes.includes(charHeightKeys[index])), 0.5));

{    // TODO: Extend similar logic to apply to other descenders such as "p" and "q"
    // Adjust height of capital J (which often has a height greater than other capital letters)
    // All height from "J" above that of "A" is assumed to occur under the baseline
    const actJMult = Math.max(round6(fontMetricsObj["charHeight"][74]) / charHeightA, 0);
    const fontJMetrics = workingFont.charToGlyph("J").getMetrics();
    const fontAMetrics = workingFont.charToGlyph("A").getMetrics();
    const fontJMult = Math.max((fontJMetrics.yMax - fontJMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin), 1);
    const actFontJMult = actJMult / fontJMult;

    if (Math.abs(1 - actFontJMult) > 0.02) {
      let glyphI = workingFont.charToGlyph("J");
      let glyphIMetrics = glyphI.getMetrics();
      const yAdj = Math.round(glyphIMetrics['yMax'] - (glyphIMetrics['yMax'] * actFontJMult));

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        let pointJ = glyphI.path.commands[j];
        if (pointJ.y != null) {
          pointJ.y = Math.round(pointJ.y * actFontJMult + yAdj);
        }
        if (pointJ.y1 != null) {
          pointJ.y1 = Math.round(pointJ.y1 * actFontJMult + yAdj);
        }
        if (pointJ.y2 != null) {
          pointJ.y2 = Math.round(pointJ.y2 * actFontJMult + yAdj);
        }

      }

    }
}  
  // Adjust "p" and "q" height
  // All height from "p" or "q" above that of "a" is assumed to occur under the baseline
  const actPMult = Math.max(fontMetricsObj["charHeight"][112] / fontMetricsObj["charHeight"][97], 0);
  const actQMult = Math.max(fontMetricsObj["charHeight"][113] / fontMetricsObj["charHeight"][97], 0);

  const fontPMetrics = workingFont.charToGlyph("p").getMetrics();
  const fontQMetrics = workingFont.charToGlyph("q").getMetrics();
  const fontAMetrics = workingFont.charToGlyph("a").getMetrics();

  const fontPMult = (fontPMetrics.yMax - fontPMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin);
  const fontQMult = (fontQMetrics.yMax - fontQMetrics.yMin) / (fontAMetrics.yMax - fontAMetrics.yMin);
  const actFontMult = { "p": actPMult / fontPMult, "q": actQMult / fontQMult }

  const minA = fontAMetrics.yMin;
  
  const glyphHeight = {
    "p": fontPMetrics.yMax - fontPMetrics.yMin,
    "q": fontQMetrics.yMax - fontQMetrics.yMin
  }

  const glyphLowerStemHeight = {
    "p": minA - fontPMetrics.yMin,
    "q": minA - fontQMetrics.yMin
  }

  for (let letterI of ["p", "q"]) {
    const actFontMultI = actFontMult[letterI];
    if (Math.abs(actFontMultI) > 1.02) {
      let glyphI = workingFont.charToGlyph(letterI);
      let glyphIMetrics = glyphI.getMetrics();

      // Adjust scaling factor to account for the fact that only the lower part of the stem is adjusted
      let scaleYFactor = ((actFontMultI - 1) * (glyphHeight[letterI] / glyphLowerStemHeight[letterI])) + 1;

      //const yAdj = Math.round(glyphIMetrics['yMax'] - (glyphIMetrics['yMax'] * actFontMultI));

      for (let j = 0; j < glyphI.path.commands.length; j++) {
        let pointJ = glyphI.path.commands[j];
        if (pointJ.y && pointJ.y < minA) {
          pointJ.y = Math.round((pointJ.y - minA) * scaleYFactor);
        }
        if (pointJ.y1 && pointJ.y1 < minA) {
          pointJ.y1 = Math.round((pointJ.y1 - minA) * scaleYFactor);
        }
        if (pointJ.y2 && pointJ.y2 < minA) {
          pointJ.y2 = Math.round((pointJ.y2 - minA) * scaleYFactor);
        }

      }
    }
  }

  let fontKerningObj = new Object;

  // Kerning is limited to +/-10% of the em size for most pairs.  Anything beyond this is likely not correct.
  let maxKern = Math.round(workingFont.unitsPerEm * 0.1);
  let minKern = maxKern * -1;

  for (const [key, value] of Object.entries(fontMetricsObj["pairKerningRaw"])) {

    // Do not adjust pair kerning for italic "ff".
    // Given the amount of overlap between these glyphs, this metric is rarely accurate. 
    if (key == "102,102" && type == "italic") continue;

      let nameFirst = key.match(/\w+/)[0];
      let nameSecond = key.match(/\w+$/)[0];


      let indexFirst = workingFont.charToGlyphIndex(String.fromCharCode(parseInt(nameFirst)));
      let indexSecond = workingFont.charToGlyphIndex(String.fromCharCode(parseInt(nameSecond)));

      let fontKern = Math.round(value * xHeight - Math.max(workingFont.glyphs.glyphs[indexSecond].leftSideBearing, 0));

      // For smart quotes, the maximum amount of kerning space allowed is doubled.
      // Unlike letters, some text will legitimately have a large space before/after curly quotes.
      // TODO: Handle quotes in a more systematic way (setting advance for quotes, or kerning for all letters,
      // rather than relying on each individual pairing.)
      if (["8220", "8216"].includes(nameFirst) || ["8221", "8217"].includes(nameSecond)) {
        fontKern = Math.min(Math.max(fontKern, minKern), maxKern * 2);
      
      // For pairs that commonly use ligatures ("ff", "fi", "fl") allow lower minimum
      } else if (["102,102", "102,105", "102,108"].includes(key)) {
        fontKern = Math.min(Math.max(fontKern, Math.round(minKern * 1.5)), maxKern);
      } else {
        fontKern = Math.min(Math.max(fontKern, minKern), maxKern);
      }

      fontKerningObj[indexFirst+","+indexSecond] = fontKern;
    }


    workingFont.kerningPairs = fontKerningObj;

    // Remove GSUB table (in most Latin fonts this table is responsible for ligatures, if it is used at all).
    // The presence of ligatures (such as ﬁ and ﬂ) is not properly accounted for when setting character metrics.
    //workingFont.tables.gsub = null;


    // Quick fix due to bug in pdfkit (see note in renderPDF function)
    //workingFont.tables.name.postScriptName["en"] = workingFont.tables.name.postScriptName["en"].replaceAll(/\s+/g, "");

    return([workingFont,workingFontAux]);

}


// Calculations that are run after all files (both image and OCR) have been loaded.
export function calculateOverallFontMetrics(fontMetricObjsMessage){
  // TODO: Figure out what happens if there is one blank page with no identified characters (as that would presumably trigger an error and/or warning on the page level).
  // Make sure the program still works in that case for both Tesseract and Abbyy.
  let charErrorCt = 0;
  let charWarnCt = 0;
  let charGoodCt = 0;
  for (const [key, value] of Object.entries(fontMetricObjsMessage["messageAll"])) {
    if(value == "char_error"){
      charErrorCt = charErrorCt + 1;
    } else if(value == "char_warning"){
      charWarnCt = charWarnCt + 1;
    } else {
      charGoodCt = charGoodCt + 1;
    }
  }

  let fontMetricsObj = new Object;

  if (charGoodCt == 0 && charErrorCt > 0) {
    document.getElementById("charInfoError").setAttribute("style", "");
    return;
  } else if (charGoodCt == 0 && charWarnCt > 0) {
    if (Object.keys(fontMetricsObj).length > 0) {
      document.getElementById('optimizeFont').disabled = false;
      document.getElementById('download').disabled = false;
    } else {
      document.getElementById("charInfoAlert").setAttribute("style", "");
      document.getElementById('download').disabled = false;
    }
  } else {
    document.getElementById('optimizeFont').disabled = false;
    document.getElementById('download').disabled = false;


    // fontMetricsObj["charWidth"] = new Object;
    // fontMetricsObj["charHeight"] = new Object;
    // fontMetricsObj["pairKerning"] = new Object;
    // fontMetricsObj["pairKerningRaw"] = new Object;
    // fontMetricsObj["cutMedian"] = new Object;

    const pageN = fontMetricObjsMessage["widthObjAll"].length;

    let widthObj = new Object;
    for (let i = 0; i < pageN; i++) {
      for (const [style, obj] of Object.entries(fontMetricObjsMessage["widthObjAll"][i])) {
        if (widthObj[style] == null) {
          widthObj[style] = new Array();
        }
        for (const [key, value] of Object.entries(obj)) {
          if (widthObj[style][key] == null) {
            widthObj[style][key] = new Array();
          }
          Array.prototype.push.apply(widthObj[style][key], value);
        } optimizeFont
      }
    }

    let heightObj = new Object;
    for (let i = 0; i < pageN; i++) {
      for (const [style, obj] of Object.entries(fontMetricObjsMessage["heightObjAll"][i])) {
        if (heightObj[style] == null) {
          heightObj[style] = new Array();
        }
        for (const [key, value] of Object.entries(obj)) {
          if (heightObj[style][key] == null) {
            heightObj[style][key] = new Array();
          }
          Array.prototype.push.apply(heightObj[style][key], value);
        }
      }
    }

    let cutObj = new Object;
    for (let i = 0; i < pageN; i++) {
      for (const [style, obj] of Object.entries(fontMetricObjsMessage["cutObjAll"][i])) {
        if (cutObj[style] == null) {
          cutObj[style] = new Array();
        }
        for (const [key, value] of Object.entries(obj)) {
          if (cutObj[style][key] == null) {
            cutObj[style][key] = new Array();
          }
          Array.prototype.push.apply(cutObj[style][key], value);
        }
      }
    }

    let kerningObj = new Object;
    for (let i = 0; i < pageN; i++) {
      for (const [style, obj] of Object.entries(fontMetricObjsMessage["kerningObjAll"][i])) {
        if (kerningObj[style] == null) {
          kerningObj[style] = new Array();
        }
        for (const [key, value] of Object.entries(obj)) {
          if (kerningObj[style][key] == null) {
            kerningObj[style][key] = new Array();
          }
          Array.prototype.push.apply(kerningObj[style][key], value);
        }
      }
    }

    let heightCapsObj = new Array();
    for (let i = 0; i < pageN; i++) {
      for (const [style, obj] of Object.entries(fontMetricObjsMessage["heightObjAll"][i])) {
        if (heightCapsObj[style] == null) {
          heightCapsObj[style] = new Array();
        }
        for (const [key, value] of Object.entries(obj)) {
          if (/[A-Z]/.test(String.fromCharCode(parseInt(key)))) {
            Array.prototype.push.apply(heightCapsObj[style], value);
          }
        }
      }
    }

    let heightSmallCapsObj = new Array();
    for (let i = 0; i < pageN; i++) {
      for (const [key, value] of Object.entries(fontMetricObjsMessage["heightSmallCapsObjAll"][i])) {
        if (/[A-Z]/.test(String.fromCharCode(parseInt(key)))) {
          Array.prototype.push.apply(heightSmallCapsObj, value);
        }
      }
    }
    let heightSmallCaps = round6(quantile(heightSmallCapsObj, 0.5)) ?? 1;

    // In the case of crazy values, revert to default of 1
    heightSmallCaps = heightSmallCaps < 0.7 || heightSmallCaps > 1.3 ? 1 : heightSmallCaps;

    fontMetricsObj["heightSmallCaps"] = heightSmallCaps;

    for (const [style, obj] of Object.entries(widthObj)) {
      if (!fontMetricsObj[style]) {
        fontMetricsObj[style] = {};
      }
      if (!fontMetricsObj[style]["charWidth"]) {
        fontMetricsObj[style]["charWidth"] = {};
      }
      for (const [key, value] of Object.entries(obj)) {
        fontMetricsObj[style]["charWidth"][key] = round6(quantile(value, 0.5));
      }
    }

    for (const [style, obj] of Object.entries(heightObj)) {
      if (!fontMetricsObj[style]["charHeight"]) {
        fontMetricsObj[style]["charHeight"] = {};
      }
      for (const [key, value] of Object.entries(obj)) {
        fontMetricsObj[style]["charHeight"][key] = round6(quantile(value, 0.5));
      }
    }

    //fontMetricsObj["heightCaps"] = {};
    for (const [style, obj] of Object.entries(heightCapsObj)) {
      fontMetricsObj[style]["heightCaps"] = round6(quantile(obj, 0.5));
    }

    for (const [style, obj] of Object.entries(cutObj)) {
      if (!fontMetricsObj[style]["cutMedian"]) {
        fontMetricsObj[style]["cutMedian"] = {};
      }
      for (const [key, value] of Object.entries(obj)) {
        fontMetricsObj[style]["cutMedian"][key] = round6(quantile(value, 0.5));
      }
    }

    for (const [style, obj] of Object.entries(kerningObj)) {
      if (!fontMetricsObj[style]["pairKerningRaw"]) {
        fontMetricsObj[style]["pairKerningRaw"] = {};
        fontMetricsObj[style]["pairKerning"] = {};
      }
      for (const [key, value] of Object.entries(obj)) {
        fontMetricsObj[style]["pairKerningRaw"][key] = round6(quantile(value, 0.5));
        const kerningNorm = quantile(value, 0.5) - fontMetricsObj[style]["cutMedian"][key.match(/\w+$/)];
        if (Math.abs(kerningNorm) > 0.02 && value.length >= 3) {
          fontMetricsObj[style]["pairKerning"][key] = round6(kerningNorm);
        }
      }
    }
  }

  return(fontMetricsObj);
}



// Note: Small caps are treated differently from Bold and Italic styles.
// Browsers will "fake" small caps using smaller versions of large caps.
// Unfortunately, it looks like small caps cannot be loaded as a FontFace referring
// to the same font family.  Therefore, they are instead loaded to a different font family.
// https://stackoverflow.com/questions/14527408/defining-small-caps-font-variant-with-font-face
export async function createSmallCapsFont(font, fontFamily, heightSmallCaps, fontMetricsObj = null) {
  
  font = await font;
  let fontData = font.toArrayBuffer();
  let workingFont = opentype.parse(fontData, { lowMemory: false });

  let oGlyph = workingFont.charToGlyph("o");
  let oGlyphMetrics = oGlyph.getMetrics();
  let xHeight = oGlyphMetrics.yMax - oGlyphMetrics.yMin;
  let fontAscHeight = workingFont.charToGlyph("A").getMetrics().yMax;
  const smallCapsMult = xHeight * (heightSmallCaps ?? 1) / fontAscHeight;
  const lower = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
  const singleStemClassA = ["i", "l", "t", "I"];
  const singleStemClassB = ["f", "i", "j", "l", "t", "I", "J", "T"];


  for(let i=0;i<lower.length;i++){
    const charLit = lower[i];
    const glyphIUpper = workingFont.charToGlyph(charLit.toUpperCase());
    const glyphI = workingFont.charToGlyph(charLit);

    glyphI.path.commands = JSON.parse(JSON.stringify(glyphIUpper.path.commands));

    //glyphI.path.commands = [...glyphIUpper.path.commands];
    for(let j=0; j < glyphI.path.commands.length; j++){
      let pointJ = glyphI.path.commands[j];
      if(pointJ.x != null){
        //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x = Math.round(pointJ.x * (smallCapsMult));
      }
      if(pointJ.x1 != null){
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x1 = Math.round(pointJ.x1 * (smallCapsMult));
      }
      if(pointJ.x2 != null){
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.x2 = Math.round(pointJ.x2 * (smallCapsMult));
      }

      if(pointJ.y != null){
        //pointJ.x = Math.round((pointJ.x - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y = Math.round(pointJ.y * (smallCapsMult));
      }
      if(pointJ.y1 != null){
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y1 = Math.round(pointJ.y1 * (smallCapsMult));
      }
      if(pointJ.y2 != null){
        //pointJ.x1 = Math.round((pointJ.x1 - glyphIMetrics.xMin) * scaleXFactor) + glyphIMetrics.xMin;
        pointJ.y2 = Math.round(pointJ.y2 * (smallCapsMult));
      }

    }

    glyphI.advanceWidth = Math.round(glyphIUpper.advanceWidth * smallCapsMult);

  }

  // Remove ligatures, as these are especially problematic for small caps fonts (as small caps may be replaced by lower case ligatures)
  workingFont.tables.gsub = null;

  let fontDataSmallCaps = workingFont.toArrayBuffer();
  await loadFont(fontFamily + "-small-caps", fontDataSmallCaps, true);
  return;

}
