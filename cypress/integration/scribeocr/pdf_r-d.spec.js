const httpServer = Cypress.env('TESTSITE');

describe('It', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  it('recognises and downloads a text file from a pdf with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/aurelia.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()

    cy.wait(11000)

    cy.get('#nav-download-tab').click()
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
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/the_past.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()

    cy.wait(12000)

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Color')
    cy.wait(500)

    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf')
  })

  it('r & d pdf from pdf, no imported ocr data, BINARY', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/henreys_grave.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    
    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()

    cy.wait(12000)

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Binary')
    cy.wait(500)

    cy.get('#nav-download-tab').click()
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
  it('recognises and downloads a hocr file from a pdf with no imported ocr data', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/multi_pdf_nd/pretty_faces.pdf'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')

    cy.get('#nav-recognize-tab').click()
    cy.get('#recognizeAll').click()

    cy.wait(12000)

    cy.get('#nav-download-tab').click()
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
})