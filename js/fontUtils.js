
// File summary:
// Utility functions used for loading fonts.
// To make sure what the user sees on the canvas matches the final pdf output,
// all fonts should have an identical OpenType.js and FontFace version.

import { createSmallCapsFont } from "./fontOptimize.js";

// Load all font styles for specified font family
export async function loadFontFamily(fontFamily, fontMetricsObj) {
  const heightSmallCaps = fontMetricsObj?.["heightSmallCaps"] || 1;

  if(fontFamily.toLowerCase() == "open sans"){
    await loadFont("Open Sans-italic", null, true);
    await loadFont("Open Sans", null, true);
    await loadFont("Open Sans-small-caps", null, true);
    await createSmallCapsFont(window.fontObj["Open Sans"]["small-caps"], "Open Sans", heightSmallCaps);
  } else if(fontFamily.toLowerCase() == "libre baskerville"){
    await loadFont("Libre Baskerville-italic", null, true);
    await loadFont("Libre Baskerville", null, true);
    await loadFont("Libre Baskerville-small-caps", null, true);
    await createSmallCapsFont(window.fontObj["Libre Baskerville"]["small-caps"], "Libre Baskerville", heightSmallCaps);
  }
}

// Load font as FontFace (used for displaying on canvas)
export async function loadFontBrowser(fontFamily, fontStyle, src, overwrite = false) {

  if(typeof(window.fontFaceObj) == "undefined"){
    window.fontFaceObj = new Object;
  }

  // Only load font if not already loaded.
  if(overwrite || !document.fonts.check(fontStyle + " 10px '" + fontFamily + "'")){
    let newFont;
    if(fontStyle == "small-caps"){
        newFont = new FontFace(fontFamily + " Small Caps", src);
    } else {
      newFont = new FontFace(fontFamily, src, {style:fontStyle});
    }

    if(typeof(fontFaceObj[fontFamily]) == "undefined"){
      fontFaceObj[fontFamily] = new Object;
    }

    if(typeof(fontFaceObj[fontFamily][fontStyle]) != "undefined"){
      document.fonts.delete(fontFaceObj[fontFamily][fontStyle]);
    }

    fontFaceObj[fontFamily][fontStyle] = newFont;

    await newFont.load();
    // add font to document
    document.fonts.add(newFont);
    // enable font with CSS class
    document.body.classList.add('fonts-loaded');

  }

  // Without clearing the cache FabricJS continues to use old font metrics.
  fabric.util.clearFabricFontCache(fontFamily);
  fabric.util.clearFabricFontCache(fontFamily + " Small Caps");

}


// Load font as opentype.js object, call loadFontBrowser to load as FontFace
export async function loadFont(font, src = null, overwrite = false){
  if(typeof(window.fontObj) == "undefined"){
    window.fontObj = {};
  }

  if(typeof(window.fontObjRaw) == "undefined"){
    window.fontObjRaw = {};
  }



  if(src == null){
    src = fontFiles[font];
  }

  let styleStr = font.match(/[\-](.+)/);
  if(styleStr == null){
    styleStr = "normal";
  // Alternative names for "Normal"
  } else {
    styleStr = styleStr[1].toLowerCase()
    if(["medium","roman"].includes(styleStr)){
        styleStr = "normal";
      }
  }

  const familyStr = font.match(/[^\-]+/)[0];

  if(!fontObj[familyStr]){
    fontObj[familyStr] = new Object;
  }

  if(!fontObjRaw[familyStr]){
    fontObjRaw[familyStr] = new Object;
  }


  // Only load font if not already loaded
  if(overwrite || !fontObj[familyStr][styleStr]){
    if(typeof(src) == "string"){
      // UNFINISHED
      if(!window.fontObjRaw[familyStr][styleStr]){
        fontObj[familyStr][styleStr] = opentype.load(src).then((x) => {
          fontObj[familyStr][styleStr] = x.toArrayBuffer();
          return x;
        });
      } else {
        fontObj[familyStr][styleStr] = opentype.parse(fontObjRaw[familyStr][styleStr], {lowMemory:false});
      }
      

      src = "url(" + src + ")";
    } else {
      fontObj[familyStr][styleStr] = opentype.parse(src, {lowMemory:false});

    }
  }
  await loadFontBrowser(familyStr, styleStr, src, overwrite = overwrite);
}

// Object containing location of various font files
var fontFiles = new Object;
fontFiles["Libre Baskerville"] = "./fonts/LibreBaskerville-Regular.woff";
fontFiles["Libre Baskerville-italic"] = "./fonts/LibreBaskerville-Italic.woff";
fontFiles["Libre Baskerville-small-caps"] = "./fonts/LibreBaskerville-Regular.woff";

fontFiles["Open Sans"] = "./fonts/OpenSans-Regular.woff";
fontFiles["Open Sans-italic"] = "./fonts/OpenSans-Italic.woff";
fontFiles["Open Sans-small-caps"] = "./fonts/OpenSans-Regular.woff";
