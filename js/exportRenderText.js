
export function renderText(hocrCurrent){

  let textStr = "";
  const exportParser = new DOMParser();

  const pdfPageMinElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMin'));
  const pdfPageMaxElem = /** @type {HTMLInputElement} */(document.getElementById('pdfPageMax'));
  let minValue = parseInt(pdfPageMinElem.value);
  let maxValue = parseInt(pdfPageMaxElem.value);

  for(let g = (minValue-1); g < maxValue; g++){
    if(g > 0){
      textStr = textStr + "\n\n";
    }
    // The exact text of empty pages can be changed depending on the parser, so any data <50 chars long is assumed to be an empty page
    if(hocrCurrent[g]?.length < 50) continue;
    const pageXML = exportParser.parseFromString(hocrCurrent[g],"text/xml");
    const lines = pageXML.getElementsByClassName("ocr_line");
    for (let h = 0; h < lines.length; h++) {
      if(h > 0){
        textStr = textStr + "\n";
      }

      const line = lines[h];
      const words = line.getElementsByClassName("ocrx_word");

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if(i > 0){
          textStr = textStr + " ";
        }
        textStr = textStr + word.textContent;

      }
    }
  }

  const textBlob = new Blob([textStr]);
  const downloadFileNameElem = /** @type {HTMLInputElement} */(document.getElementById('downloadFileName'));
  let fileName = downloadFileNameElem.value.replace(/\.\w{1,4}$/, "") + ".txt";

  saveAs(textBlob, fileName);

}
