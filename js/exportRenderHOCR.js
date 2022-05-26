
export function renderHOCR(hocrCurrent, fontMetricsObj){

  let minValue = parseInt(document.getElementById('pdfPageMin').value);
  let maxValue = parseInt(document.getElementById('pdfPageMax').value);

  const exportParser = new DOMParser();
  let firstPageStr;
  // Normally the content from the first page is used, however when the first page is empty or encounters a parsing error another page is used
  for (let i = (minValue - 1); i < maxValue; i++){
    // The exact text of empty pages can be changed depending on the parser, so any data <50 chars long is assumed to be an empty page
    if (hocrCurrent[i]?.length > 50) {
      firstPageStr = hocrCurrent[i].replace(/\<html\>/, "<html xmlns=\"http://www.w3.org/1999/xhtml\" xml:lang=\"en\" lang=\"en\">");
      break;
    }
  }

  // If HTML start/end nodes do not already exist, append them now
  // This is relevant for OCR data generated within this program,
  // as well as imported Abbyy data.
  if(!/[^\>\n]*?(xml|html)/.test(firstPageStr)){
    let html_start = String.raw`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
 <head>
  <title></title>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/>
  <meta name='ocr-system' content='tesseract 5.0.0-beta-20210916-12-g19cc9' />
  <meta name='ocr-capabilities' content='ocr_page ocr_carea ocr_par ocr_line ocrx_word ocrp_wconf ocrp_lang ocrp_dir ocrp_font ocrp_fsize'/>
 </head>
 <body>`

    let html_end = String.raw` </body>
</html>`

    firstPageStr = html_start + firstPageStr + html_end;
  }

  let exportXML = exportParser.parseFromString(firstPageStr,"text/xml");

  let fontXML = exportParser.parseFromString("<meta name='font-metrics' content='" + JSON.stringify(fontMetricsObj) + "'></meta>","text/xml");
   exportXML.getElementsByTagName("head")[0].appendChild(fontXML.firstChild);

   // TODO: Consider how empty pages are handled (e.g. what happens when the first page is empty)
  for (let i = minValue; i < maxValue; i++){

    const pageXML = hocrCurrent[i]?.length > 50 ? exportParser.parseFromString(hocrCurrent[i], "text/xml") : exportParser.parseFromString('<div class="ocr_page"></div>', "text/xml");

    exportXML.body.appendChild(pageXML.getElementsByClassName("ocr_page")[0])

  }

  let hocrInt = exportXML.documentElement.outerHTML;
  hocrInt = hocrInt.replaceAll(/xmlns\=[\'\"]{2}\s?/ig, "");


  let hocrBlob = new Blob([hocrInt]);

  let fileName = document.getElementById("downloadFileName").value.replace(/\.\w{1,4}$/, "") + ".hocr";

  saveAs(hocrBlob, fileName);
}
