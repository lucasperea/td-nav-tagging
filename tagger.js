/* Navigation Tagger - pure logic (no DOM). Works in browser and Node. */
(function (root) {
  'use strict';

  /* ---------- TSV parser (handles quoted cells with newlines) ---------- */
  function parseTSV(text) {
    var rows = [], row = [], cell = '', inQ = false, i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
        } else cell += c;
      } else if (c === '"' && cell === '') {
        inQ = true;
      } else if (c === '\t') {
        row.push(cell); cell = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  /* ---------- helpers ---------- */
  function pascal(s) {
    return String(s || '')
      .replace(/['’]/g, '')
      .replace(/&/g, ' N ')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); })
      .join('');
  }
  function tc(s) { return pascal(String(s).toLowerCase()); }
  function isDate(s) { return /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s); }
  function toDate(s) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s || '');
    if (!m) return null;
    var y = +m[3]; if (y < 100) y += 2000;
    return new Date(y, +m[1] - 1, +m[2]);
  }
  function isMenuRow(cells) {
    var first = '';
    for (var i = 0; i < cells.length; i++) {
      if (cells[i] && !isDate(cells[i])) { first = cells[i]; break; }
    }
    // a nav name is short, all caps, and has no digits/underscores - so a file title like
    // "HOLIDAY TWO 2026_CONTENT PLAN MASTER" is not mistaken for a menu
    return first && first === first.toUpperCase() && /[A-Z]/.test(first) && !/[0-9_]/.test(first) &&
      first.indexOf(':') < 0 && first.length < 40 ? first : '';
  }
  function pickSection(row, urlIdx) {
    if (!row) return '';
    var order = [urlIdx - 1, urlIdx - 2, urlIdx];
    for (var i = 0; i < order.length; i++) {
      var v = row[order[i]];
      if (v) return v;
    }
    return '';
  }

  /* ---------- group defaults (from nav folders) ---------- */
  // known = positions/ids seen in existing nav markup
  function groupDefaults(menu, section) {
    var k = (menu + ' ' + section).toUpperCase();
    var has = function (s) { return k.indexOf(s) >= 0; };
    var d = { id: 'Dropdown_Links', pos: '', namePrefix: '', known: true };
    var sec = section.toUpperCase();
    var guess = function (m) { var s = (section.toUpperCase() === menu.toUpperCase()) ? 'Categories' : tc(section); return 'Dropdown_' + m + '_' + s; };

    if (has('HOLIDAY')) { d.pos = 'Dropdown_HolidayShop_Featured'; d.namePrefix = 'HolidayShop_'; }
    else if (has('CASTING')) { d.pos = 'Dropdown_CastingCall_Featured'; d.namePrefix = 'CastingCall_'; }
    else if (has('JEANS')) { d.id = 'Jeans_Dropdown'; d.pos = 'Jeans_Nav_Dropdown'; d.namePrefix = sec === 'FEATURED' ? '' : 'Jeans_'; }
    else if (has('TOPS')) { d.id = 'Tops_Dropdown'; d.pos = 'Tops_Nav'; d.namePrefix = 'Tops_'; d.known = true; }
    else if (has('DRESSES')) {
      if (sec === 'FEATURED') d.pos = 'Dropdown_Dresses_Featured';
      else if (sec === 'OCCASION') d.pos = 'Dropdown_Dresses_Occasion';
      else { d.pos = guess('Dresses'); d.known = false; }
    }
    else if (has('INTIMATES')) {
      if (sec === 'FEATURED') d.pos = 'Dropdown_Intimates_Featured';
      else if (sec === 'BRAS') { d.pos = 'Dropdown_Intimates_Bras'; d.namePrefix = 'Bras_'; }
      else { d.pos = 'Dropdown_Intimates_Panties'; d.namePrefix = ''; d.known = false; }
    }
    else if (has('SHOES')) {
      if (sec === 'ACCESSORIES') d.pos = 'Dropdown_ShoesAccessories_Accessories';
      else d.pos = 'Dropdown_ShoesAccessories_Shoes';
    }
    else if (has('BRANDS') && !has('CLOTHING')) {
      d.pos = 'Dropdown_Brands';
    }
    else if (has('CLOTHING')) {
      if (sec === 'FEATURED') d.pos = 'Dropdown_Clothing_Featured';
      else if (sec === 'BRANDS') d.pos = 'Dropdown_Clothing_Brands';
      else { d.pos = guess('Clothing'); d.known = false; }
    }
    else if (has('NEW')) {
      if (sec === 'FEATURED') d.pos = 'Dropdown_New_Featured';
      else if (sec === 'BRANDS') d.pos = 'Dropdown_New_Brands';
      else { d.pos = guess('New'); d.known = false; }
    }
    else { d.pos = guess(tc(menu)); d.known = false; }
    return d;
  }

  /* ---------- URL + tag builders ---------- */
  var SEG_MAP = {
    'clothing': 'Clothing', 'intimates': 'TorridCurveIntimates', 'shoes-accessories': 'ShoesAccessories',
    'brands': 'Brands', 'new': 'NewNow', 'featured': 'NewNow_Featured', 'dresses': 'Clothing_Dresses',
    'jeans': 'Clothing_Jeans', 'casting-call': 'CastingCall'
  };
  function defaultCatName(path) {
    var segs = path.split('/').filter(Boolean);
    if (!segs.length) return '';
    var out = [];
    segs.forEach(function (s, i) {
      out.push(i === 0 && SEG_MAP[s] ? SEG_MAP[s] : pascal(s));
    });
    return out.join('_');
  }
  function defaultPromoName(label, group) {
    return (group.namePrefix || '') + pascal(label);
  }
  function isExternal(p) { return /^https?:\/\//i.test(p); }
  // Used when the user types a URL into a link: -> { path, query } or null when empty
  function normalizeUrl(raw) {
    var u = String(raw || '').replace(/\s+/g, ' ').trim().split(' ')[0];
    if (!u) return null;
    u = u.replace(/^https?:\/\/(www\.)?torrid\.com/i, '');
    if (u.charAt(0) !== '/' && !isExternal(u)) u = '/' + u;
    var qi = u.indexOf('?'), qs = qi < 0 ? '' : u.slice(qi + 1);
    return {
      path: qi < 0 ? u : u.slice(0, qi),
      query: qs.split('&').filter(Boolean).filter(function (q) { return !/^promo_/i.test(q); })
    };
  }
  // promo_creative from an asset: drop the CDN host/path, query and extension.
  // https://cdn.torrid.com/i/torrid/2611_NAV_Holiday_MB?fmt=auto  ->  2611_NAV_Holiday_MB
  function assetName(raw) {
    var s = String(raw || '').trim().split(/\s+/)[0] || '';
    s = s.split('#')[0].split('?')[0].replace(/\/+$/, '');
    s = s.slice(s.lastIndexOf('/') + 1);
    return s.replace(/\.(jpe?g|png|gif|webp|svg|avif)$/i, '');
  }
  function buildLink(row, group, base) {
    if (row.missing) return '';
    if (isExternal(row.path)) base = '';
    var params = row.query.slice();
    params.push('promo_id=' + group.id);
    params.push('promo_name=' + row.promoName);
    params.push('promo_creative=TextOnly');
    params.push('promo_position=' + group.pos);
    return (base || '') + row.path + '?' + params.join('&');
  }

  /* ---------- main sheet parser ---------- */
  function parseSheet(text, today) {
    today = today || new Date();
    var grid = parseTSV(text);
    var rows = [], skipped = [], groups = {}, groupOrder = [];
    var blocks = null, pending = [], menu = '';
    var uid = 0;

    grid.forEach(function (raw, n) {
      var cells = raw.map(function (c) { return c.replace(/\s+/g, ' ').trim(); });
      // keep the raw (newline-trimmed) value for URLs
      var rawCells = raw.map(function (c) { return c.trim(); });
      if (!cells.some(Boolean)) { blocks = null; return; }

      var urlIdxs = [];
      cells.forEach(function (c, i) { if (c.toUpperCase() === 'URL') urlIdxs.push(i); });

      if (urlIdxs.length) {
        var sectionRow = pending[pending.length - 1];
        var cand = '';
        for (var p = pending.length - 2; p >= 0; p--) {
          cand = isMenuRow(pending[p]);
          if (cand) break;
        }
        if (cand) menu = cand;
        else if (!menu && sectionRow) menu = isMenuRow(sectionRow) || '';
        var curMenu = menu;
        blocks = urlIdxs.map(function (i, bi) {
          // id = which header row + which label/URL block, so one section can span several display columns
          return { id: n + ':' + bi, url: i, label: i - 1, menu: curMenu, section: pickSection(sectionRow, i) || curMenu };
        });
        pending = [];
        return;
      }

      if (blocks) {
        blocks.forEach(function (b) {
          var label = cells[b.label] || '';
          var urlCell = (rawCells[b.url] || '').replace(/\s+/g, ' ').trim();
          if (!label && !urlCell) return;
          var start = cells[b.url + 1] || '', end = cells[b.url + 2] || '';
          var owner = cells[b.url + 3] || '', notes = cells[b.url + 4] || '';
          var flags = [];
          if (/\s+New\s*$/i.test(label) && label.replace(/\s+New\s*$/i, '')) {
            label = label.replace(/\s+New\s*$/i, ''); flags.push('NEW flag');
          }
          var key = b.menu + '|' + b.section;
          if (!groups[key]) {
            groups[key] = Object.assign({ key: key, menu: b.menu, section: b.section }, groupDefaults(b.menu, b.section));
            groupOrder.push(key);
          }
          var g = groups[key];
          if (!urlCell) {
            // keep the link in the output (highlighted) so the gap is visible in its menu
            flags.push('Missing URL');
            skipped.push({ row: n + 1, menu: b.menu, section: b.section, label: label, reason: 'No URL' });
            rows.push({
              id: ++uid, sheetRow: n + 1, group: key, menu: b.menu, section: b.section,
              label: label, path: '', query: [], start: start, end: end, owner: owner, notes: notes,
              flags: flags, catName: '', catEdited: false, blk: b.id, isNew: flags.indexOf('NEW flag') >= 0,
              promoName: defaultPromoName(label, g), nameEdited: false, missing: true
            });
            return;
          }
          // url cell may carry a trailing tag hint or "(redirect)"
          var parts = urlCell.split(' ');
          var u = parts.shift(), hint = '';
          parts.forEach(function (t) {
            if (/^\(.*\)$/.test(t)) flags.push(t.slice(1, -1).toLowerCase() === 'redirect' ? 'Redirect' : t);
            else if (/^[A-Za-z0-9_]+$/.test(t)) hint = t;
          });
          if (/redirect/i.test(notes) && flags.indexOf('Redirect') < 0) flags.push('Redirect');
          if (/redirect/i.test(label) && flags.indexOf('Redirect') < 0) flags.push('Redirect');
          u = u.replace(/^https?:\/\/(www\.)?torrid\.com/i, '');
          if (u.charAt(0) !== '/' && !isExternal(u)) { u = '/' + u; flags.push('Added leading /'); }
          var qi = u.indexOf('?'), path = qi < 0 ? u : u.slice(0, qi), qs = qi < 0 ? '' : u.slice(qi + 1);
          var query = qs.split('&').filter(Boolean), hadPromo = false;
          query = query.filter(function (q) {
            if (/^promo_/i.test(q)) { hadPromo = true; return false; }
            return true;
          });
          if (hadPromo) flags.push('Replaced promo params');
          if (qi >= 0 && !qs) flags.push('Stripped trailing ?');
          var sd = toDate(start), ed = toDate(end);
          if (sd && sd > today) flags.push('Starts ' + start);
          if (ed && ed < today) flags.push('Ended ' + end);

          rows.push({
            id: ++uid, sheetRow: n + 1, group: key, menu: b.menu, section: b.section,
            label: label, path: path, query: query, start: start, end: end, owner: owner, notes: notes,
            flags: flags, catName: hint || defaultCatName(path), catEdited: !!hint, blk: b.id, isNew: flags.indexOf('NEW flag') >= 0,
            promoName: defaultPromoName(label, g), nameEdited: false
          });
        });
        return;
      }
      pending.push(cells);
      if (pending.length > 4) pending.shift();
    });

    return { rows: rows, skipped: skipped, groups: groups, groupOrder: groupOrder };
  }

  /* ---------- XLSX workbook (ExcelJS passed in so this stays testable) ---------- */
  var RED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
  var HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
  var BAR_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
  var THIN = { style: 'thin', color: { argb: 'FF000000' } };
  var BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
  var XLSX_COLS = ['Promo Name', 'Start Date', 'End Date', 'URL', 'URL w/ Tagging', 'Notes'];
  var XLSX_WIDTHS = [36, 14, 14, 46, 100, 30];

  // One sheet, laid out like the content sheet:
  //   NAV (black bar)            e.g. NEW
  //   Section row                e.g. Featured
  //   header row                 Promo Name | Start Date | End Date | URL | URL w/ Tagging | Notes
  //   one row per link           (missing URL = red row)
  // then the next section of that nav, then the next nav.
  function buildWorkbook(ExcelJS, rows, groups, order, linkFn) {
    var wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Navigation');
    var line = 1, last = XLSX_COLS.length, menus = [], c;
    order.forEach(function (k) {
      var m = groups[k].menu;
      if (menus.indexOf(m) < 0 && rows.some(function (r) { return r.menu === m; })) menus.push(m);
    });

    menus.forEach(function (m) {
      for (c = 1; c <= last; c++) { ws.getCell(line, c).fill = BAR_FILL; ws.getCell(line, c).font = { bold: true, color: { argb: 'FFFFFFFF' } }; }
      ws.getCell(line, 1).value = m.toUpperCase();
      line++;

      order.forEach(function (k) {
        if (groups[k].menu !== m) return;
        // links in nav order: column by column (one column per sheet block)
        var idx = {}, cols = [];
        rows.forEach(function (r) {
          if (r.group !== k) return;
          if (!(r.blk in idx)) { idx[r.blk] = cols.length; cols.push([]); }
          cols[idx[r.blk]].push(r);
        });
        var items = [].concat.apply([], cols);
        if (!items.length) return;

        ws.getCell(line, 1).value = groups[k].section;
        ws.getCell(line, 1).font = { bold: true };
        line++;

        XLSX_COLS.forEach(function (h, i) {
          var cell = ws.getCell(line, i + 1);
          cell.value = h; cell.font = { bold: true }; cell.fill = HEAD_FILL; cell.border = BORDER;
        });
        line++;

        items.forEach(function (r) {
          var plain = r.missing ? '' : r.path + (r.query.length ? '?' + r.query.join('&') : '');
          var notes = r.notes || (r.missing ? 'Missing URL' : '');
          var vals = [r.promoName, r.start, r.end, plain, r.missing ? '' : linkFn(r), notes];
          vals.forEach(function (v, i) {
            var cell = ws.getCell(line, i + 1);
            cell.value = v; cell.border = BORDER;
            cell.alignment = { vertical: 'top' };
            if (r.missing) cell.fill = RED_FILL;
          });
          line++;
        });
        line++; // blank row between sections
      });
      line++; // extra gap between navs
    });

    XLSX_WIDTHS.forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    return wb;
  }

  var api = {
    parseTSV: parseTSV, parseSheet: parseSheet, buildLink: buildLink, pascal: pascal,
    defaultPromoName: defaultPromoName, defaultCatName: defaultCatName, buildWorkbook: buildWorkbook, normalizeUrl: normalizeUrl, assetName: assetName,
    groupDefaults: groupDefaults,
    // bump whenever parsing rules change, so a stale auto-saved session is re-parsed instead of restored
    PARSER_VERSION: 2
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tagger = api;
})(typeof window !== 'undefined' ? window : this);
