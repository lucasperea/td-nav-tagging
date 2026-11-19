# Navigation Tagger: Help

Navigation Tagger turns your nav content sheet into tagged links. Paste the sheet, review the links, then copy tagged output for Wrike (or download it as CSV/XLSX).

Open `index.html` in a browser. There is nothing to install. You need an internet connection for the page styling and the XLSX download.

---

## Quick start

1. **Paste.** Copy the cells from Excel or Google Sheets and paste them into the box in step 1. Links generate automatically on paste. You can also click **Generate** or press **Ctrl+Enter**.
2. **Review.** Fix missing URLs, confirm guessed fields, reorder links and add the nav asset.
3. **Export.** Click **Copy N links for Wrike**, then paste into Wrike.

No sheet handy? Click **Load sample data** to see how it works.

---

## What your sheet should look like

Copy the cells, not the file. The tool reads tab-separated text, which is what Excel and Sheets put on your clipboard.

For each section, include:

```
TOPS                                  <- nav name (ALL CAPS)
FEATURED                              <- section name
Link        URL                 Start      End     Owner
New Arrivals   /tops/new-arrivals/
Holiday Tops   /tops/holiday/    11/20/26           Alex
```

- The **header row must contain a cell that says `URL`**. The tool finds each block by that cell. The label sits in the column to its left. Start, End, Owner and Notes sit in the columns to its right.
- **Nav names** are short, ALL CAPS, with no numbers or underscores. A file title such as `HOLIDAY TWO 2026_CONTENT PLAN MASTER` is ignored. You can rename the nav later.
- A section can have several **Link / URL column pairs side by side**. They stay in order as separate columns.
- A blank row ends a block.

### Things you can type in a cell

| In the sheet | What the tool does |
|---|---|
| `New` at the end of a link name | Removes it from the name and turns the **NEW** switch on |
| `(redirect)` after a URL, or "redirect" in the name or Notes | Flags the link as **Redirect** |
| A tag after the URL, e.g. `/featured/rosy/ NewNow_Featured_Blush` | Uses it as the link's `data-category_name` |
| A full `https://www.torrid.com/...` URL | Strips the domain. Turn on **Full URLs** to add it back. |
| A URL without a leading `/` | Adds the `/` and flags **Added leading /** |
| Existing `promo_` parameters in a URL | Replaces them with fresh ones and flags **Replaced promo params** |
| An empty URL cell | Keeps the link and marks it **Missing URL** |

### Site Merch Updates sheets

The tool also reads the "Site Merch Updates" layout, whose header has `Viewport`, `Shop Name` and `URL / ID`.

- DESKTOP rows become links.
- APP rows are never output. If an APP row has a tag ID (e.g. `NewNow_NewArrivals_Tops`) and the same link name, that ID becomes the desktop link's `data-category_name`.
- A heading row with only the first cell filled sets the nav (ALL CAPS) or the section (anything else). Sections ending in "App" are ignored.
- If the sheet has no nav headings, the tool **guesses the nav and section from the URLs**. Rename them in the details table (see below).

---

## Step 2: Review

### Status line

A one-line summary sits above the tabs:

- **N missing URLs · Next →** jumps to the next link with no URL and puts the cursor in its URL box.
- **N to confirm** shows fields the tool had to guess. **Confirm all** accepts them.
- **N rows skipped** is a count of rows with no URL. Hover to see which. They still appear in the list as Missing URL.
- **All set** means nothing needs attention.

### Show details: promo_id, promo_position, name prefix

Open this section to check how each nav section is tagged.

| Field | What it is |
|---|---|
| **Menu / Section** | Click the menu name to rename it. The rename applies to all of its sections and links. |
| **promo_id** | The group name for these links in analytics |
| **promo_position** | Where the link sits in the nav |
| **name prefix** | Added to the front of every `promo_name` in the section |

**Dashed blue fields were guessed.** The tool recognizes common navs (Holiday, Jeans, Tops, Dresses, Intimates, Shoes, Brands, Clothing, New). For anything else it builds a best guess. Check these and edit them if needed. Editing a field confirms it. Fields you type yourself are kept when you rename the nav.

### Menu tabs

Tabs across the top filter the list: **All** plus one tab per nav. A red dot means that nav has missing URLs.

### Link cards

Each link is a card showing its name and URL path. Flags such as Redirect, Ended or Starts 11/20/26 appear on the right.

| Control | What it does |
|---|---|
| **Checkbox** | Include or exclude the link from the output |
| **NEW switch** | Adds ` NEW` to the name in the Wrike output |
| **☰ handle** | Drag to reorder. You can also move a link into another column of the same nav. It takes on that column's section and tagging. You can't drag between navs. |
| **▸ arrow** | Opens the card. Missing-URL cards start open. |

Opened cards show:

- **URL box.** Type or paste a URL, then press Enter or click away. The full tagged link appears below it. Clearing the box marks the link as missing again.
- **Move up / Move down.** Keyboard and touch alternative to dragging, within the same column.
- **Tags.**
  - `data-category_name` defaults to a name built from the URL path.
  - `promo_name` defaults to name prefix + link name in PascalCase.
  - Edit either one and your edit is kept.

**Select all shown** ticks or unticks every link on the current tab.

### The tagged link

Every link is output as:

```
/path/?promo_id=<id>&promo_name=<name>&promo_creative=TextOnly&promo_position=<position>
```

Any non-promo query parameters in the original URL are kept first.

### Nav asset (banner image)

Each nav has an **Asset** panel at the right, for the banner image in the dropdown.

| Field | Notes |
|---|---|
| **Image** | A CDN link or a bare file name. Bare names are looked up on the Torrid CDN. A preview appears below. |
| **Destination link** | The page the banner goes to |
| **promo_name** | Defaults to the matching link's name, or the last part of the destination |
| **promo_position** | Defaults to `Dropdown_<Nav>_Banner` |

`promo_creative` is taken from the **image file name** (host, path, query and extension removed). For example, `https://cdn.torrid.com/i/torrid/2611_NAV_Holiday_MB?fmt=auto` becomes `2611_NAV_Holiday_MB`. The asset appears in the Wrike output only, not in CSV/XLSX.

### Options

Under **Options** next to Generate:

- **Full URLs** adds `https://www.torrid.com` to every link.
- **Hide redirects / ended** hides flagged links from the list **and from exports**. A note above the list shows what is hidden, with a one-click way to undo it.

---

## Step 3: Export

### Copy for Wrike

The main button copies one table per navigation. Paste into Wrike and it keeps its formatting.

- One column per sheet column, plus **Asset**.
- Each cell shows the link name, the bold path, the four promo parameters, and a highlighted `ID: data-category_name`.
- Unticked links, and flagged links if Hide is on, are left out.
- Links with no URL show as **MISSING URL**.

Under **Wrike navigations to include**, untick a nav to leave out its table. **Show Wrike preview** displays what will be copied.

### Other formats

Click the arrow beside the main button:

| Option | Output |
|---|---|
| **Copy table (TSV)** | One row per link, tab-separated, for pasting into Excel or Sheets |
| **Copy URLs only** | Tagged URLs, one per line. Links with no URL are skipped. |
| **Download CSV** | `nav-tagging.csv`, same columns as the table |
| **Download XLSX** | `nav-tagging.xlsx`. It is laid out like the content sheet, with a black bar per nav, section rows and a header row. Missing URLs are shaded red. |

The table, CSV, XLSX and URL options **respect the current menu tab**. Choose **All** to export every nav. The Wrike copy always uses the navigation checkboxes instead.

While you scroll through the review step, a slim bar at the bottom keeps a **Copy** button within reach.

---

## Saving your work

- **Autosave.** Your work saves in this browser as you go (see "Saved" at the top). It is stored only in this browser, on this computer. Another browser or computer will not see it.
- **Project ▾ → Save to file** downloads a `.json` copy of everything: sheet, edits, order, assets and Wrike choices. Use it to keep a backup or share with a teammate.
- **Project ▾ → Load from file** reopens a saved file.
- **Project ▾ → Clear sheet** empties everything.
- **Undo.** Clearing, regenerating and loading sample data show a toast with **Undo** for about 8 seconds.

> **Regenerating resets your edits.** Pasting or clicking Generate re-reads the sheet and discards URL edits, reordering and asset entries. Undo brings them back.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "No link blocks detected" | The header row with the `URL` cell wasn't included. Re-copy including it. |
| Nav is named wrong or "MERCH" | The sheet has no nav headings. Rename it in **Show details**. |
| Wrong `promo_position` | It was guessed. Edit it in **Show details**. |
| A link is missing from the export | It may be unticked, hidden by **Hide redirects / ended**, or on a different tab. |
| The **Copy** buttons don't paste into Wrike with formatting | Use **Copy for Wrike**, not Copy table. |
| "XLSX library failed to load" | Check your internet connection and reload the page. |
| Status shows "Not saved" | The browser blocked or filled its storage. Use **Save to file**. |
| Old session looks wrong after an update | Sessions from an older version of the tool are re-read from the pasted sheet. Your project file may need regenerating. |

---

## Reference: how names are built

- **promo_name** = name prefix + link name in PascalCase. "Shop All Sweaters" with prefix `Tops_` becomes `Tops_ShopAllSweaters`. Apostrophes are dropped and `&` becomes `N`.
- **data-category_name** comes from the URL path. First segments are mapped, e.g. `clothing` → `Clothing`, `intimates` → `TorridCurveIntimates`, `new` → `NewNow`. The rest is PascalCase joined with `_`.
- **promo_creative** is `TextOnly` for links and the image file name for assets.
