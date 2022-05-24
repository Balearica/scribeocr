const httpServer = Cypress.env('TESTSITE');

describe('It recognises and downloads a', () => {
  /* beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  }) */

  // JPG Recognize -> Download 
  
  it('text file from a jpg with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_jpg/aurelia.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.jpg', 
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/snow_drops.jpg'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(30000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a jpg with no imported ocr data, NATIVE', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_jpg/the_past.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Native')

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past', {contains: true})
  })

  it('pdf file from a jpg with no imported ocr data, BINARY', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_jpg/the_past.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Binary')

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past', {contains: true})
  })

  it('pdf file from 4 jpgs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/aurelia.jpg', 
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/snow_drops.jpg'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(30000)


    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a jpg with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/snow_drops.jpg'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.hocr')
  })

  it('text file from 4 jpgs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/the_past.jpg', 
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/aurelia.jpg', 
      'cypress/fixtures/snow_drops.jpg',
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(30000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })
  
  // PDF Recognize -> Download 

  it('text file from a pdf with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/aurelia.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(11000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })
/*
  it('recognises and downloads a text file from 5 pdfs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_pdf_nd/snow_drops.pdf', 
      'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
      'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
      'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf',
      'cypress/fixtures/multi_pdf_nd/the_past.pdf'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '5')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.txt')
  })
*/
it('r & d pdf from pdf, no imported ocr data, COLOR', () => {
  cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
  cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/the_past.pdf'])
  cy.wait(3000)
  cy.get('#pageCount').should('have.text', '1')
  
  cy.get('#nav-recognize-tab').click()
  cy.wait(3000)
  cy.get('#recognizeAll').click()

  cy.wait(12000)

  cy.get('#nav-view-tab').click()
  cy.wait(3000)
  cy.get('#colorMode').select('Color')
  

  cy.get('#nav-download-tab').click()
  cy.wait(3000)
  cy.get('#downloadFormat').click()
  cy.get('#formatLabelOptionPDF').click()
  cy.get('#download').click()
  cy.verifyDownload('the_past.pdf')
})

it('r & d pdf from pdf, no imported ocr data, BINARY', () => {
  cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
  cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/henreys_grave.pdf'])
  cy.wait(3000)
  cy.get('#pageCount').should('have.text', '1')
  
  cy.get('#nav-recognize-tab').click()
  cy.wait(3000)
  cy.get('#recognizeAll').click()

  cy.wait(12000)

  cy.get('#nav-view-tab').click()
  cy.wait(3000)
  cy.get('#colorMode').select('Binary')
  

  cy.get('#nav-download-tab').click()
  cy.wait(3000)
  cy.get('#downloadFormat').click()
  cy.get('#formatLabelOptionPDF').click()
  cy.get('#download').click()
  cy.verifyDownload('henreys_grave.pdf')
})
/*
  it('recognises and downloads a pdf file from 5 pdfs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_pdf_nd/the_past.pdf', 
      'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
      'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
      'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf',
      'cypress/fixtures/multi_pdf_nd/snow_drops.pdf'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '5')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)


    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })
*/
  it('hocr file from a pdf with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/pretty_faces.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr')
  })
/*
  it('recognises and downloads a text file from 5 pdfs with no imported ocr data', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_pdf_nd/pretty_faces.pdf', 
      'cypress/fixtures/multi_pdf_nd/aurelia.pdf',
      'cypress/fixtures/multi_pdf_nd/henreys_grave.pdf', 
      'cypress/fixtures/multi_pdf_nd/snow_drops.pdf',
      'cypress/fixtures/multi_pdf_nd/the_past.pdf'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '5')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()
    cy.wait(10000)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr')
  })
*/

  //PNG Recognize -> Download

  it('text file from a png with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_png/aurelia.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia.txt')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/henreys_grave.png', 
      'cypress/fixtures/multi_png/aurelia.png',
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/pretty_faces.png'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt')
  })

  it('pdf file from a png with no imported ocr data, NATIVE', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_png/the_past.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Native')
    
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from a png with no imported ocr data, BINARY', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_png/the_past.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Binary')
    
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('pdf file from 4 pngs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/pretty_faces.png'
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(35000)


    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia.pdf')
  })

  it('hocr file from a png with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(15000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr')
  })

  it('text file from 4 pngs with no imported ocr data', () => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
    
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_png/the_past.png', 
      'cypress/fixtures/multi_png/henreys_grave.png',
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/pretty_faces.png',
    ])
    cy.wait(10000)
    cy.get('#pageCount').should('have.text', '4')

    cy.get('#nav-recognize-tab').click()
    cy.wait(3000)
    cy.get('#recognizeAll').click()
    cy.wait(35000)

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()  
    cy.get('#download').click()
    cy.verifyDownload('the_past.hocr')
  })

})