const {
  PDFDocument, 
  PDFTextField, 
  PDFCheckBox, 
  PDFButton, 
  PDFDropdown, 
  PDFOptionList, 
  PDFRadioGroup, 
  PDFSignature,
  PDFName,
  PDFRawStream,
} = require('pdf-lib');

const fs = require('fs');
const createHTML = require('create-html')
const { Poppler } = require("node-poppler");
const ejs = require('ejs');
const poppler = new Poppler();

class PdfTemplate {

  async loadTemplate(templatePath) {
      const templateFile = fs.readFileSync(templatePath);
      this.templateDoc = await PDFDocument.load(templateFile);
  }

  async initDoc() {
      this.resultDoc = await PDFDocument.create();
  }

  async addDocPage() {
      const newPageBytes = await this.templateDoc.save();
      const newPage = await PDFDocument.load(newPageBytes);
      const [pageToAdd] = await this.resultDoc.copyPages(newPage, [0]);
      return this.resultDoc.addPage(pageToAdd);
  }

  async saveResult(outputPath) {
      const pdfBytes = await this.resultDoc.save();
      fs.writeFileSync(outputPath, pdfBytes);
  }
}

const pdf_template = new PdfTemplate();

const renderHTML = async (pdf) => {
  await pdf_template.initDoc();
  await pdf_template.loadTemplate(pdf);
  const pages = pdf_template.templateDoc.getPages()
  let pdf_info = []
  let page_count = pages.length;

  const options = {
    firstPageToConvert: 1,
    lastPageToConvert: page_count,
    pngFile: true,
  };
  const outputFile = `./src/assets/images/page`;
  console.log('Converting pages...')
  const res = await poppler.pdfToCairo(pdf, outputFile, options);
  console.log(res)

  for(index in pages) {
    const page = pages[index]
    const { x, y, width, height } = page.getMediaBox();
    console.log('=========================')
    let page_info = {
      x: x,
      y: y,
      width: width,
      height: height
    }
    // console.log(page)
    const forms = page.doc.getForm()
    let field_list = []
    forms.getFields().map(field => {
      let field_name = field.getName();
      const type_list = {
          'text_field': PDFTextField,
          'checkbox_field': PDFCheckBox,
          'button_field': PDFButton,
          'dropdown_field': PDFDropdown,
          'optionlist_field': PDFOptionList,
          'radiogroup_field': PDFRadioGroup,
          'signature_field': PDFSignature
      }
      for(var field_type in type_list) {
          let what = false;
          what = field instanceof type_list[field_type]
          if (!what)  continue;
          let coordinates = []
          for (var widget of field.acroField.getWidgets()) {
            coordinates.push(widget.Rect().asRectangle())
          }
          switch(field_type) {
            case 'radiogroup_field':
            case 'dropdown_field':
            case 'optionlist_field':
              field_list.push({
                field_name, field_type, 'options': field.getOptions(), 'selected': field.getSelected(), coordinates
              })
              break;
            case 'checkbox_field':
              field_list.push({
                field_name, field_type, 'isChecked': field.isChecked(), coordinates
              })
              break;
            default :
              field_list.push({
                field_name, field_type, coordinates
              })
          }
      }
    })
    field_list.map(item => {
      console.log(item)
    })
    pdf_info.push({
      info: page_info,
      content: field_list
    })
  }
  
  // Saving as a HTML
  fs.cp('./src/assets/', './dist/assets/', {recursive: true}, function(err) {
    console.log(err)
  });
  let background = []
  for(var i = 1; i <= page_count; i++)
    background.push(`./assets/images/page-${i}.png`)
  let html_body = ''
  await ejs.renderFile('./src/index.ejs', {data: pdf_info, backImgs: background}, function(err, str) {
    html_body = str
  })

  let html = createHTML({
    title: 'Converted HTML from PDF',
    script: [
      "https://ajax.googleapis.com/ajax/libs/jquery/1.12.0/jquery.min.js",
      "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/js/bootstrap.min.js",
      './assets/script.js'
    ],
    css: [
      "https://maxcdn.bootstrapcdn.com/bootstrap/3.3.6/css/bootstrap.min.css",
      './assets/style.css'
    ],
    lang: 'en',
    head: '<meta name="description" content="Easy converting from PDF to HTML">',
    body: html_body,
  })
  fs.writeFile('./dist/index.html', html, function (err) {
    if (err) console.log(err)
  })

};

let pdf_path = './pdf/myPdf.pdf';
renderHTML(pdf_path)
