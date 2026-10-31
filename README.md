# Fard Reader

An offline app (installable web app) that reads a Punjab Fard / Jamabandi land-record PDF on the phone and shows every
owner in English (with the Punjabi name under it), their share, their land in acres and Kanal-Marla, the khewat
(as printed: new / old number), its khatauni and khasra numbers, and the page each one is on. Nothing is uploaded:
the PDF is read in the browser.

Current version: **20.7**.

## How it works

- `engine.js` reads the Fard. For downloaded Fards it uses the PDF's text layer (exact digits); for scanned Fards it
  renders each page and uses Tesseract OCR (Punjabi). It finds the table grid, reads each khewat's owners, shares,
  khataunis, khasras and total, and checks them: shares must add up to 1, the owners' land must add up to the khewat
  total, and the Kanal-Marla total must agree with the hectare figure printed beside it. Anything that does not check
  out is marked for a patwari to confirm.
- `app.js` shows the results (khewat view and by-person view) and the notes; `translit.js` turns Punjabi names into English.
- `sw.js` + `manifest.webmanifest` make it work offline once it has been opened.
- `vendor/` holds the libraries it runs on (see `THIRD_PARTY_NOTICES.md`).

## Running it

It is a static site: serve this folder with any web server (for example `python3 -m http.server`) and open
`index.html`, or deploy the folder as-is to Netlify. `HOW_TO_SET_UP.md` has the step-by-step setup for phones and the
notes for every version.

## Accuracy

Version 20.7 was checked against about 4,900 khewats from over 700 downloaded Land Records: every khewat total and
owner share was compared with what is printed in the Fard. About 87% of khewats are confirmed exactly (91% of the
digital Fards), about 8% are issues in the Fard itself (shares that do not add up, a wrong hectare figure, a part the
site could not print, a cut-off PDF), 0.4% are still open for review, and the rest are scanned copies, where only the
app's own checks apply.
