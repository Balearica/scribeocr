const httpServer = Cypress.env('TESTSITE');

describe('It downloads a', () => {
  beforeEach(() => {
    cy.visit(httpServer);
    cy.get('#nav-import-tab').click();
  })

  //JPG Upload -> Download 

  it('text file from jpg with hOCR', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
      'cypress/fixtures/multi_jpg/henreys_grave.xml',
      'cypress/fixtures/multi_jpg/henreys_grave.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('henreys_grave', {contains: true})
    
  })
  
  it('text file from 4 jpgs with 4 hOCRs', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
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
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.txt', {contains: true})
    
  }) 

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), NATIVE', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Native')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf', {contains: true})
    
  })

  it('downloads a pdf file from jpg with hOCR (xml for browserstack but data from tess), BINARY', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
      'cypress/fixtures/multi_jpg/the_past.xml',
      'cypress/fixtures/multi_jpg/the_past.jpg'
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Binary')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('the_past.pdf', {contains: true})
    
  })
  
  it('pdf file from 4 jpgs with 4 hOCRs', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
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

  it('hocr file from jpg', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
      'cypress/fixtures/multi_jpg/aurelia_jpg.xml',
      'cypress/fixtures/multi_jpg/aurelia.jpg',
    ])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('aurelia_jpg.hocr', {contains: true})

  })

  it('hocr file from 4 jpgs', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile([
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
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('snow_drops.hocr', {contains: true})
    
  }) 

  // PDF Upload -> Download 

  it('text file from a pdf with different page numbered xml', () => {
    cy.wait(5000)
    cy.get('#uploader', { timeout: 10000 }).selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 
        'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'
    ])
    cy.get('#pageCount').should('have.text', '114')
    cy.wait(5000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.wait(5000)
    cy.get('#download').click()
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.txt')
  })
  /* 
  it('downloads a pdf file from a pdf with different page numbered xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#pageCount').should('have.text', '114')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.wait(20000)
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.pdf', {contains: true})
  })
  it('downloads a hocr file from a pdf with different page numbered xml', () => {
    cy.get('#uploader').selectFile(
      ['cypress/fixtures/siegeofcorinthpo00byrorich_abbyy.xml', 'cypress/fixtures/siegeofcorinthpo00byrorich_bw.pdf'])
    cy.get('#pageCount').should('have.text', '114')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.wait(20000)
    cy.verifyDownload('siegeofcorinthpo00byrorich_bw.hocr', {contains: true})
  })
  */

  // PNG Upload -> Download 

  it('text file from a png with hOCR', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(100)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.txt', {contains: true})
  })

  it('text file from 4 pngs with 4 hOCRs', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/pretty_faces.xml', 
      'cypress/fixtures/pretty_faces.png', 
      'cypress/fixtures/multi_png/aurelia_png.xml', 
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/multi_png/henreys_grave_png.xml', 
      'cypress/fixtures/multi_png/henreys_grave.png', 
      'cypress/fixtures/multi_png/the_past_png.xml', 
      'cypress/fixtures/multi_png/the_past.png'])
    cy.get('#pageCount').should('have.text', '4')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionText').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.txt', {contains: true})
  })

  it('pdf file from a png with hOCR, BINARY', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'])
    cy.wait(100)
    cy.get('#pageCount').should('have.text', '1')
    

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Binary')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.wait(1000)
    cy.verifyDownload('pretty_faces.pdf', {contains: true})
  })

  it('pdf file from a png with hOCR, NATIVE', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'])
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(100)

    cy.get('#nav-view-tab').click()
    cy.get('#colorMode').select('Native')
    cy.wait(500)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.pdf', {contains: true})
  })

  it('pdf file from 4 pngs with 4 hOCRs', () => {
    cy.get('#uploader').selectFile([
      'cypress/fixtures/pretty_faces.xml', 
      'cypress/fixtures/pretty_faces.png', 
      'cypress/fixtures/multi_png/aurelia_png.xml', 
      'cypress/fixtures/multi_png/aurelia.png', 
      'cypress/fixtures/multi_png/henreys_grave_png.xml', 
      'cypress/fixtures/multi_png/henreys_grave.png', 
      'cypress/fixtures/multi_png/the_past_png.xml', 
      'cypress/fixtures/multi_png/the_past.png'])
    cy.get('#pageCount').should('have.text', '4')
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionPDF').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.pdf', {contains: true})
  })

  it('hocr file from jpg)', () => {
    cy.get('#uploader').selectFile(['cypress/fixtures/pretty_faces.xml', 'cypress/fixtures/pretty_faces.png'])
    cy.wait(3000)
    cy.get('#pageCount').should('have.text', '1')
    cy.wait(3000)
    cy.get('#nav-download-tab').click()
    cy.get('#downloadFormat').click()
    cy.get('#formatLabelOptionHOCR').click()
    cy.get('#download').click()
    cy.verifyDownload('pretty_faces.hocr', {contains: true})

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
    cy.wait(4000)
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
