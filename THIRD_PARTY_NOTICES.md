# Third-party software in `vendor/`

These files are included unchanged so the app works offline. Each keeps its own licence.

| Files | Project | Version | Licence |
|---|---|---|---|
| `pdf.min.mjs`, `pdf.worker.min.mjs` | [PDF.js](https://github.com/mozilla/pdf.js) (Mozilla) | 4.10.38 | Apache License 2.0 |
| `standard_fonts/Foxit*.pfb` | Foxit fonts shipped with PDF.js | - | see `standard_fonts/LICENSE_FOXIT` |
| `standard_fonts/LiberationSans-*.ttf` | Liberation fonts shipped with PDF.js | - | SIL Open Font License 1.1, see `standard_fonts/LICENSE_LIBERATION` |
| `tesseract.esm.min.js`, `tesseract-worker.min.js` | [Tesseract.js](https://github.com/naptha/tesseract.js) | 5.1.1 | Apache License 2.0 |
| `core/tesseract-core-*.wasm.js` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 5.x (the build paired with Tesseract.js 5.1.1) | Apache License 2.0 |
| `lang/pan.traineddata` | Punjabi model from [tessdata](https://github.com/tesseract-ocr/tessdata) | - | Apache License 2.0 |

Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0
