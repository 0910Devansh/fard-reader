# Fard Reader - set up and use

An offline app for Android phones. The surveyor opens the Fard PDF the owner sent, and the phone
shows every owner in English (with the Punjabi name under it), their land in acres and Kanal-Marla,
the khewat, its khasra numbers, and the page number. Nothing is uploaded: the PDF is read on the phone.

## Updating the site you already have (land-record-reader.netlify.app)

1. Unzip the new `FardReader.zip` on your Mac.
2. On Netlify, open your project, click **Deploys** in the left menu, scroll to the drop box at the
   bottom and drag the new `FardReader` folder onto it. Wait until it says Published.
3. On each phone: open the app once with internet on; it updates itself. (If it still shows the
   old version, close it fully and open it again.)

## 1. Put the app online once (you, about 10 minutes)

1. Unzip `FardReader.zip`. You get a folder called `FardReader`.
2. Go to https://app.netlify.com and sign up for free, with your own email or Google account.
3. Add a new site and choose to deploy manually (Netlify calls this "Deploy manually" or
   "drag and drop"). Drag the whole `FardReader` folder onto the page. Wait until it says published.
4. Netlify gives the site a random name. In the site's settings, change the site name to something
   like `varaha-fard-reader`. Your link is then `https://varaha-fard-reader.netlify.app`.

(Netlify's menu names change from time to time; look for "deploy" and "site name".)

## 2. Install on each surveyor's phone (2 minutes, needs internet once)

1. Send the link on WhatsApp. The surveyor opens it in **Chrome**.
2. Wait until the green header says **"Ready to use offline"** (about a minute; about 23 MB downloads once).
3. In Chrome's menu (the three dots), tap **Install app** or **Add to Home screen**.
4. From now on, open **Fard Reader** from its icon. It works with no internet.

## 3. Use it in the field

1. Tap **Open Fard PDF** and pick the PDF (WhatsApp saves documents in the phone's Files app,
   under WhatsApp Documents, or use "Share" from WhatsApp and pick Files first).
2. Keep the app open while it reads - roughly a few seconds per page, so a few minutes for a
   25-page Fard. If the phone locks the screen, reading may pause until it is opened again.
3. Read the results:
   - **Yellow "Check" boxes**: something did not add up - usually a misread share or the record
     itself (e.g. shares printed as 1211/1212). The page to look at is given.
   - **Later red notes**: the Fard has red entries (ਇੰਤਕਾਲ / ਰਪਟ) after this Jamabandi - an
     ownership change, mortgage or court order. The app does not apply them; read that page.
4. The results are one table: **Name | Khasra No. | Khewat No. | Acres | Kanal-Marla | Share | Khatauni No.**
   - The Name column (with the Punjabi name and the page number) stays in place when you scroll sideways.
   - Tap a row to highlight it across the whole table, so you don't read the row above or below by mistake.
   - Khasra, Khewat and Khatauni numbers are shown once per khewat, next to all its owners.
   - Acres = Kanal-Marla converted with 1 acre = 8 kanal = 160 marla.
   - **By person** shows each owner's land added up across all khewats.

## Good to know

- Works on Fards downloaded from the Punjab land records website and on flat scans of them.
  Photos of paper Fards taken with a phone camera are not supported yet.
- English names are spelled from the Punjabi by rules, so spellings are approximate (Mejar
  for Major, Dawinder for Davinder). The Punjabi name as read from the Fard is shown under it.
- Every total is checked against its own hectare figure printed in the Fard, and all shares in a
  khewat must add up to 1. Repeated pages in one PDF are counted once.
- Khasra numbers are read from downloaded Fards and checked against the Fard's own count (ਕਿਤੇ).
  For scanned copies they are not shown, because the "//" marks cannot be read reliably.
- Shares, totals and land are self-checked. Names are read by OCR and are not; one letter can
  occasionally be misread (e.g. ਮੋਹਰ for ਮੇਹਰ), so compare with the Punjabi line when it matters.

## Updating the app later

Drag the new `FardReader` folder onto the same Netlify site (its "Deploys" page). Phones pick up
the new version the next time the app is opened with internet.

## New in Version 16

- **Relation column.** Each owner's relation (s/o, d/o, w/o, widow of …) is shown in its own column next to the name.
- **Save / share as PDF.** After reading a Fard, tap **Save / share as PDF**. The phone's print screen opens; choose **Save as PDF** (or **Share**) to keep or send the full result, both tables included.
- **Saved results.** Every Fard you read is kept on the phone (the latest 50). They appear under **Saved results** on the start screen; tap one to reopen it instantly, offline. Nothing is uploaded.
- **Mortgage entries (ਬਿੱਲਾਰਾਹਿਨ / ਰਾਹਿਨ / ਮੁਰਤਹਿਨਾਨ).** When an owner's land is printed in two parts (unmortgaged + mortgaged), the parts are added together, and the people marked as mortgagees are listed separately as "mortgage parties, not owners". This is done **only when the owners' shares then add up to exactly 1**; otherwise the entries are shown as printed with a yellow "check with a patwari".
- **Scanned copies.** If a share looks misread (for example 1/8 read as 1/6) and exactly one correction would make the shares add up, the app shows the suggestion in yellow. It never changes a number by itself.
- **Extra checks.** A khewat number out of order on a scan, and a khasra printed with an impossible area (a printing fault in the record), are flagged in yellow.

## New in Version 17

- **Khasras that were missed are now found:** a khasra printed at the start of a khewat just after the previous khewat's total row, and a khasra whose area is printed slightly higher than its number. Owners' land is not affected; only the khasra lists become complete.
- **Name spellings:** when the OCR misreads one letter of a father's or grandfather's name (for example ਅਚਜਨ instead of ਅਰਜਨ) and the same family is written correctly in most other entries of the Fard, the app uses the correct spelling **and shows a note under the name** ("spelling ਅਚਜਨ corrected to ਅਰਜਨ"). It never changes an owner's own first name, never merges real spelling variants (Jasbir/Jasvir, ਸ/ਸ਼, vowel signs), and never changes a spelling the record itself prints.

## New in Version 18

- **A khewat printed twice is now counted once.** Some downloaded Fards contain the same record twice. When the second copy has the same khewat number, total and owner shares, it is no longer added again, so each owner's acres in **By person** are correct. The khewat shows "also printed on pages …" instead.

## New in Version 19

- **Khewat numbers written over two lines are read as one khewat.** A combined khewat such as "97- 98/" is shown as khewat 97-98, and a new number with its old number under it (such as "542/ 505/ 1") is shown as khewat 542. Before, each of these produced an extra, empty khewat.
- **An owner list that starts at the bottom of the previous page keeps every share.** When a khewat's owners begin just before its number on the next page, a share printed on a line of its own (for example "1/6 ਹਿੱਸਾ") is no longer lost.
- **The start of a khewat printed again is counted once.** When a Fard repeats the first page(s) of a khewat without its total, the repeat is shown as "printed again" instead of being counted as another khewat.
- **Mortgage entries:** when owners' mortgaged parts (ਵਾ ਨੀਂਜ ਰਾਹਿਨ) add up exactly to one entry's share, that entry is the mortgagee (ਮੁਰਤਹਿਨ) and is listed as a mortgage party, not an owner. Anyone marked ਬਿੱਲਾਰਾਹਿਨ (unmortgaged) is always kept as an owner; if the shares then do not add up, the entries are shown as printed with a yellow "check with a patwari".
- **Mortgages in the remarks column (ਆੜ ਰਹਿਨ) are shown even when printed in black**, on downloaded Fards: "Remarks mention a mortgage on page …". It does not say whether the mortgage was later released (ਫੱਕ); read that page.
- **Shamlat (ਸ਼ਾਮਲਾਤ) khewats** are labelled as village common land and are not added to any person under **By person**.

## New in Version 20

Tested on 16 Fards (about 1,100 pages, 178 khewats) from Mansa, Ferozepur, Fazilka, Barnala and Sri Muktsar Sahib.

- **Two kinds of flags.** **Yellow "Check"** now means only that the acres of that khewat may be affected (shares that do not add up, a total that could not be confirmed, a misread on a scan). **Grey "Note"** is for things worth knowing that do not change anyone's land (khasra list incomplete, a mortgage that was worked out exactly, a khewat printed twice, a stray word in the owner column). The summary line counts the two separately.
- **Mortgage groups worked out.** Many Fards list the mortgagors, then write ਰਾਹਿਨਾਨ, then the mortgagee(s), then ਮੁਰਤਹਿਨ / ਮੁਰਤਹਿਨਾਨ. The app now reads these labels as belonging to the entry just before them. When the mortgagees' share equals exactly what the mortgagors pledged, and the owners then add up to exactly 1, the mortgagees are listed as "mortgage parties, not owners". If the numbers do not work out, the entries are shown as printed with a yellow "check with a patwari".
- **First owner's name completed.** The land-records site sometimes prints the first words of the first owner's name at the end of the owner list (for example "ਅਮਰ ਸਿੰਘ" at the bottom and "ਪੁੱਤਰ ਰਾਮ ਸਿੰਘ ..." at the top). The app now joins them, only when the shares already add up to 1, and shows a note under the name.
- **Pages the site failed to print.** A page saying "Error: Subreport could not be shown" no longer creates an empty extra khewat; the good copy is used and the note says where it failed.
- **Khasra count** is now checked against the khewat's own "ਮਿਜਾਨ ਕਿਤੇ" count, so khataunis with unnumbered sub-rows no longer cause a false warning.
- **Khatauni numbers with a sub-number** (837/1, 265/2) are now read.
- **Better English names.** Common spellings are now used (Kaur, Darshan, Sher, Wazir, Uttam, Bahadur, Krishan, Bhagwan, Kewal, Heera, Boota, Kapoor, Parveen, Pradeep ...). Measured against standard spellings of 8,600 name words in the 16 Fards, agreement went from 83% to 94%. The Punjabi name is still shown under the English one; compare with it when it matters.

## Version 20.1

- **Acres are shown to 4 decimal places** (for example 0.3417 instead of 0.342), in the owner rows, the khewat totals and **By person**. Kanal-Marla is unchanged.

## Version 20.2

- **Bigha-biswa Fards (Patiala side)** are now read correctly: land is shown as "B - b" and converted to acres with 1 biswa = 5/3 marla (checked against the hectare figures in the Fard). Before, these were treated as kanal-marla and the acres came out about 40% too low.
- **Khewat numbers written with a comma** ("287/ 334," with the old number below) are no longer split into two khewats.
- **A khewat whose number is printed garbled** and therefore split in two is joined back, only when the two parts' shares then add up to exactly 1. A grey note asks you to check the number on that page.

## Version 20.3

- **Sub-numbered khewats keep their full number.** A khewat printed as "194/ 180" with "1/" written below it is shown as khewat **194/1**, not as a second "194" with a false "printed twice" warning.

## Version 20.4

Tested on 60 Fards (29 different records, about 1,030 pages) from Fazilka, Ferozepur, Sri Muktsar Sahib and Mansa, with every
khewat total checked against the total and hectare figure printed in the Fard.

- **A khewat at the very top of a page is no longer missed.** On some downloaded Fards the first khewat of a page is
  printed on the same line as the second line of the column headings (for example "ਮਾਲ/ਪੱਤੀ, ਨੰਬ" next to "671/ 630").
  Version 20.3 read the two as one heading line and skipped that khewat with all its owners and land, without a warning.
  When such a number was also written over two lines ("112" with "4/" below = khewat 1124), 20.3 showed a wrong khewat
  "112" with no total, and could make a stray khewat "4" from the second half. Seen in 10 of the 29 PDFs (for example
  khewat 671 of 3.1125 acres, khewat 509 of 18.6313 acres). Nothing else changes: every other khewat gives exactly the
  same result as in 20.3.
- **A mortgaged part is always added to its owner.** "ਵਾ ਨੀਂਜ ਰਾਹਿਨ 2/99" (the owner's own mortgaged part) was shown as an owner
  of its own when the mortgage entries did not add up. It is now added to the owner just before it (shares and acres unchanged);
  the yellow "check with a patwari" stays.
- Names of cultivators (column 4, ਕਾਸ਼ਤਕਾਰ) are, as before, never counted as owners, even when they are printed with shares.

## Version 20.5

- **Khewat numbers are shown as printed in the Fard: new number / old number.** For example "671/630" instead of "671",
  "1124/1061" for a number written over two lines, "866/745 ਮਿਨ" when the old khewat is only partly included, and
  "542/505/1" when the old number has a sub-number. This is shown in the khewat headings, the table and By person.
  A khewat whose old number is not printed is shown with its new number only. Nothing else changes: owners, shares,
  totals and acres are exactly the same as in 20.4.

## Version 20.6

Found by checking about 950 khewats from 160 Land Records (Amritsar, Tarn Taran, Gurdaspur and others) against the
totals printed in each Fard. All the changes are about reading the **khewat total** (ਰਕਬਾ … ਕਨਾਲ … ਮਰਲਾ) on downloaded
Fards; owners and shares are read exactly as in 20.5.

- **Totals printed at the right end of the total row are read.** Some Fards print the total row as
  "ਮਿਜਾਨ ਕਿਤੇ 1  ਮਜਰੂਆ 120 ਕਨਾਲ 16 ਮਰਲਾ … ਰਕਬਾ 120 ਕਨਾਲ 16 ਮਰਲਾ", with the ਰਕਬਾ figure running into the last column.
  20.5 missed it and added up the khatauni totals instead, which could be wrong when one of them was misread
  (for example 20 K - 16 M instead of 120 K - 16 M, or 150 K - 11 M instead of 151 K - 9 M). It now reads the printed total.
- **A total printed with 20 marla or more is read** ("120 ਕਨਾਲ 20 ਮਰਲਾ" = 121 K - 0 M, "145 ਕਨਾਲ 30 ਮਰਲਾ" = 146 K - 10 M).
  20.5 left such a total empty. The khewat now shows a note with the total as printed.
- **A total whose number is split in the PDF's text is read whole** ("ਰਕਬਾ 18 0 ਕਨਾਲ" = 180 kanal). 20.5 read it as 0 K - 0 M.
- **A stray "q" in the PDF's text** ("ਰਕਬਾ q 149 ਕਨਾਲ") no longer stops the total from being read.
- Where the Fard's own hectare figure does not match its Kanal-Marla total (this happens in some Fards), the total is
  shown as printed and the khewat is marked to check with a patwari, as before.

## Version 20.7

Found by checking about 4,200 khewats from 600 Land Records against what is printed in each Fard. Three cases where a
khewat could be split, merged into another or missed; every other khewat gives exactly the same result as in 20.6.

- **A list of old khewat numbers is read as one heading.** Some khewats list several old numbers down the first column
  ("203/" then "189/1, 199 ਮਿਨ, 189/21"). 20.6 read the last line as a new khewat "189/21", so khewat 203 lost its total
  and a khewat with no owners appeared. It now stays one khewat with its total.
- **A khewat after a break in the table is no longer missed.** When the Fard prints "Error: Subreport could not be shown."
  between two tables on a page, 20.6 stopped reading at that line and the khewat below it was left out completely, with
  all its owners. It is now read.
- **A khewat heading split over two pages is joined.** When a khewat number is printed at the very bottom of a page
  ("723/") and its old number and owners at the top of the next ("651 ਮਿਨ ..."), 20.6 showed an empty khewat 723 and a
  wrong khewat 651. It is now one khewat, 723/651, with a note to check the page.
