const httpServer = Cypress.env('TESTSITE');

describe('It', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  it('downloads a text file from jpg with hOCR (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave.txt', {contains: true})
    
  })
  
  it('downloads a text file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '4')
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.txt', {contains: true})
    
  }) 

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), NATIVE', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Native')

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf', {contains: true})
    
  })

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), BINARY', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)

    cy.get('#nav-view-tab').click()
    cy.wait(3000)
    cy.get('#colorMode').select('Binary')

    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf', {contains: true})
    
  })
  
  it('downloads a pdf file from 4 jpgs with 4 hOCRs (xml for browserstack but data from tess)', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '4')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.pdf', {contains: true})
    
  }) 

  it('downloads a hocr file from jpg', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.wait(3000)
    cy.verifyDownload('henreys_grave.hocr', {contains: true})

  })

  it('downloads a hocr file from 4 jpgs', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/snow_drops.jpg',
      'cypress/fixtures/snow_drops.xml', 
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg',
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '4')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.wait(3000)
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.wait(3000)
    cy.verifyDownload('snow_drops.hocr', {contains: true})
    
  }) 
  
})
