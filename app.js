(function () {
  'use strict';
  var T = window.Tagger;
  var state = { rows: [], skipped: [], groups: {}, order: [], menu: 'ALL', wrikeOff: {}, wrikeNavOff: {}, assets: {}, missIdx: -1 };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  function store(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  // run a destructive change, then offer Undo (restores the whole session) instead of asking "are you sure?"
  function undoable(msg, fn) {
    var before = state.rows.length ? JSON.parse(JSON.stringify(snapshot())) : null;
    fn();
    if (before) toast(msg, function () { restore(before); toast('Restored'); });
  }
  function setBtnLabel(btn, t) { btn.dataset.label = t; if (!btn.classList.contains('copied')) btn.textContent = t; }
  var wrikeLinks = 0;
  function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

  function base() { return $('fullUrl').checked ? 'https://www.torrid.com' : ''; }
  function link(r) { return T.buildLink(r, state.groups[r.group], base()); }

  function parse() {
    var text = $('sheet').value;
    store('navTagger.sheet', text);
    var res = T.parseSheet(text);
    state.rows = res.rows; state.skipped = res.skipped;
    state.groups = res.groups; state.order = res.groupOrder; state.menu = 'ALL'; state.missIdx = -1;
    renderGroups(); renderWarnings(); renderTabs(); renderRows(); renderWrikeControls();
    setStep1(state.rows.length > 0);
  }

  // collapse the paste box once links are generated; header shows a summary and toggles it back open
  function setStep1(collapsed) {
    $('step1Body').classList.toggle('d-none', collapsed);
    $('step1Toggle').classList.toggle('d-none', !collapsed);
    $('step1Toggle').setAttribute('aria-expanded', String(!collapsed));
    var n = state.rows.length;
    $('step1Summary').textContent = collapsed ? n + ' link' + (n === 1 ? '' : 's') + ' pasted \u00b7' : '';
    // steps 2 and 3 only matter once there is something to review
    $('step2').classList.toggle('d-none', !n);
    $('step3').classList.toggle('d-none', !n);
  }

  // groups whose promo_position was guessed (not seen in existing nav markup) and not yet confirmed
  function toConfirm() {
    return state.order.filter(function (k) { var g = state.groups[k]; return g.known === false && !g.confirmed; });
  }

  // Menu / Section read as plain text; only the promo fields look editable. Guessed values get a dashed outline.
  function renderGroups() {
    if (!state.order.length) {
      $('groups').innerHTML = '<div class="caption py-2">No link blocks detected. Make sure the header rows containing "URL" were included.</div>';
      return;
    }
    var guessed = toConfirm();
    $('groups').innerHTML = '<div class="group-row head"><span>Menu / Section</span><span>promo_id</span><span>promo_position</span><span>name prefix</span></div>' +
      state.order.map(function (k) {
        var g = state.groups[k];
        var guess = guessed.indexOf(k) >= 0 ? ' guess' : '';
        return '<div class="group-row"><div><input class="plain" data-mold="' + esc(g.menu) + '" title="Rename this navigation (applies to all its sections)" value="' + esc(g.menu) + '" aria-label="Menu name">' +
          '<div class="group-sec">' + esc(g.section) + '</div></div>' +
          '<input class="form-control" data-g="' + esc(k) + '" data-f="id" value="' + esc(g.id) + '" aria-label="promo_id">' +
          '<input class="form-control' + guess + '" data-g="' + esc(k) + '" data-f="pos" value="' + esc(g.pos) + '" aria-label="promo_position"' + (guess ? ' title="Guessed - confirm or edit"' : '') + '>' +
          '<input class="form-control" data-g="' + esc(k) + '" data-f="namePrefix" value="' + esc(g.namePrefix) + '" aria-label="name prefix"></div>';
      }).join('');
  }

  function missingRows() { return state.rows.filter(function (r) { return r.missing; }); }

  // One quiet status line instead of banners: "6 missing URLs \u00b7 4 to confirm". Missing jumps to the first one; Confirm all accepts guesses.
  function renderWarnings() {
    var miss = missingRows(), conf = toConfirm(), parts = [];
    if (state.missIdx >= miss.length) state.missIdx = miss.length - 1;
    if (miss.length) {
      var lbl = state.missIdx < 0 ? miss.length + ' missing URL' + (miss.length === 1 ? '' : 's') : (state.missIdx + 1) + ' of ' + miss.length + ' missing';
      parts.push('<a href="#" class="miss-link" id="nextMiss"><span class="status-dot"></span>' + lbl + ' · Next →</a>');
    }
    if (conf.length) {
      parts.push('<button type="button" class="link-btn" id="openConfirm" title="Show the guessed fields">' + conf.length + ' to confirm</button><button type="button" class="link-btn" id="confirmAll">Confirm all</button>');
    }
    if (state.skipped && state.skipped.length) {
      parts.push('<span class="status-ok" title="' + esc(state.skipped.slice(0, 10).map(function (s) { return s.menu + ' > ' + s.section + ' > ' + s.label + ' (' + s.reason + ')'; }).join('\n')) + '">' + state.skipped.length + ' row' + (state.skipped.length === 1 ? '' : 's') + ' skipped</span>');
    }
    $('warnings').innerHTML = '<div class="status-line" role="status">' + (parts.length ? parts.join('<span class="status-ok">\u00b7</span>') : '<span class="status-ok">All set</span>') + '</div>';
  }

  function renderTabs() {
    var menus = [];
    state.rows.forEach(function (r) { if (menus.indexOf(r.menu) < 0) menus.push(r.menu); });
    var items = ['ALL'].concat(menus);
    $('menuTabs').innerHTML = items.map(function (m) {
      var inMenu = state.rows.filter(function (r) { return m === 'ALL' || r.menu === m; });
      var miss = inMenu.filter(function (r) { return r.missing; }).length;
      return '<li role="presentation"><a href="#" role="tab" aria-selected="' + (m === state.menu) + '" class="' + (m === state.menu ? 'active' : '') + '" data-menu="' + esc(m) + '" title="' + inMenu.length + ' links">' +
        esc(m === 'ALL' ? 'All' : m) +
        (miss ? '<span class="miss-dot" aria-hidden="true"></span><span class="visually-hidden">, ' + miss + ' missing URL' + (miss === 1 ? '' : 's') + '</span>' : '') + '</a></li>';
    }).join('');
  }

  function visible() {
    var hide = $('hideFlagged').checked;
    return state.rows.filter(function (r) {
      if (state.menu !== 'ALL' && r.menu !== state.menu) return false;
      if (hide && r.flags.some(function (f) { return /^Redirect|^Ended/.test(f); })) return false;
      return true;
    });
  }

  function flagBadge(f) {
    var cls = /Redirect|Ended/.test(f) ? 'danger' : /Starts/.test(f) ? 'primary' : /NEW/.test(f) ? 'success' : 'secondary';
    return '<span class="badge flag text-bg-' + cls + ' me-1">' + esc(f) + '</span>';
  }

  // Mirrors the live nav: one block per parent nav, sections side by side, each section's links
  // listed top to bottom (a section can span several columns), Asset on the right.
  function subcols(rows) {
    var cols = [], idx = {};
    rows.forEach(function (r) {
      if (!(r.blk in idx)) { idx[r.blk] = cols.length; cols.push([]); }
      cols[idx[r.blk]].push(r);
    });
    return cols;
  }

  function itemHtml(r) {
    var flags = r.flags.filter(function (f) { return f !== 'NEW flag'; });
    // card = name + URL path only; tracking details, URL edit, NEW flag and tags open on expand (missing rows start open)
    var cap = flags.map(function (f) { return esc(f); }).concat(r.start ? ['Starts ' + esc(r.start)] : []);
    return '<div class="nav-item-row' + (r.missing ? ' missing open' : '') + '" data-rid="' + r.id + '">' +
      '<div class="item-main">' +
        '<span class="drag-handle" title="Drag to reorder or move to another column" aria-hidden="true">&#x2630;</span>' +
        '<input type="checkbox" class="inc" data-id="' + r.id + '" aria-label="Include ' + esc(r.label) + '" title="Include" ' + (r.exclude ? '' : 'checked') + '>' +
        '<span class="item-name">' + esc(r.label) + '</span>' +
        '<label class="newflag form-check form-switch m-0" title="Append NEW to the link name (on when the sheet says New)"><input type="checkbox" role="switch" class="form-check-input isnew" data-id="' + r.id + '" ' + (r.isNew ? 'checked' : '') + '><span class="tag-pill">NEW</span></label>' +
        (r.missing ? '<span class="miss-inline">Missing URL</span>' : '<span class="item-path" title="' + esc(r.path) + '">' + esc(r.path) + '</span>') +
        '<span class="spacer"></span>' +
        (cap.length ? '<span class="tag-pill">' + cap.join(' · ') + '</span>' : '') +
        '<button type="button" class="chev url-toggle" aria-expanded="' + (r.missing ? 'true' : 'false') + '" aria-label="Show details for ' + esc(r.label) + '" title="Show / hide details">' + (r.missing ? '&#9662;' : '&#9656;') + '</button>' +
      '</div>' +
      '<div class="item-more">' +
        '<input class="form-control url-edit" data-id="' + r.id + '" title="Edit URL (press Enter or click away to apply)" aria-label="URL" ' +
          'placeholder="Add URL, e.g. /featured/holiday-shop/" value="' + esc(r.missing ? '' : r.path + (r.query.length ? '?' + r.query.join('&') : '')) + '">' +
        '<div class="url-cell' + (r.missing ? ' is-missing' : '') + '" id="u' + r.id + '">' + (r.missing ? 'Missing URL' : esc(link(r))) + '</div>' +
        '<div class="d-flex gap-2"><button type="button" class="btn btn-quiet mv-up">Move up</button><button type="button" class="btn btn-quiet mv-down">Move down</button></div>' +
        '<details><summary>Tags</summary>' +
          '<input class="form-control mb-2" data-r="' + r.id + '" data-f="catName" title="data-category_name" aria-label="data-category_name" value="' + esc(r.catName) + '">' +
          '<input class="form-control" data-r="' + r.id + '" data-f="promoName" title="promo_name" aria-label="promo_name" value="' + esc(r.promoName) + '">' +
        '</details>' +
      '</div></div>';
  }

  /* ---------- per-nav asset (image + tagged destination link) ---------- */
  // Everything about a menu's asset, or null when nothing was entered.
  // promo_creative = asset file name only (CDN host/path/query/extension stripped).
  function assetParts(m) {
    var a = state.assets[m] || {};
    var img = (a.img || '').trim(), dest = T.normalizeUrl(a.url);
    if (!img && !dest) return null;
    var firstKey = state.order.filter(function (k) { return state.groups[k].menu === m; })[0];
    var match = dest && state.rows.filter(function (r) { return r.menu === m && r.path === dest.path; })[0];
    var seg = dest ? dest.path.split('/').filter(Boolean).pop() || '' : '';
    return {
      img: img, dest: dest,
      id: a.id || (firstKey ? state.groups[firstKey].id : 'Dropdown_Links'),
      name: a.name || (match ? match.promoName : T.pascal(seg)),
      creative: T.assetName(img),
      pos: a.pos || 'Dropdown_' + T.pascal(m.toLowerCase()) + '_Banner'
    };
  }
  // the four asset inputs; used in both the Output panel and the Wrike panel (kept in sync)
  function assetFieldsHtml(m, cls) {
    return [['img', 'Image', 'CDN link or file name'], ['url', 'Destination link', 'e.g. /featured/holiday-shop/'],
      ['name', 'promo_name', 'default: from the matching link'], ['pos', 'promo_position', 'default: Dropdown_' + T.pascal(m.toLowerCase()) + '_Banner']]
      .map(function (f) {
        return '<label class="asset-label caption">' + esc(f[1]) + '<input class="form-control form-control-sm wasset ' + cls + '" data-m="' + esc(m) + '" data-f="' + f[0] + '" placeholder="' + esc(f[2]) +
          '" value="' + esc((state.assets[m] || {})[f[0]] || '') + '"></label>';
      }).join('');
  }
  // an asset input changed (in either panel): store it, mirror it to the other panel, refresh previews
  function onAssetInput(t) {
    var a = state.assets[t.dataset.m] || (state.assets[t.dataset.m] = {});
    a[t.dataset.f] = t.value.trim();
    Array.prototype.forEach.call(document.querySelectorAll('.wasset'), function (el) {
      if (el !== t && el.dataset.m === t.dataset.m && el.dataset.f === t.dataset.f) el.value = t.value;
    });
    updateAssetPreviews(); renderWrikePreview();
  }
  function assetParams(p) {
    return [[(p.dest && p.dest.query.length ? '&' : '?') + 'promo_id=', p.id], ['&promo_name=', p.name],
      ['&promo_creative=', p.creative], ['&promo_position=', p.pos]];
  }
  function assetPath(p) {
    var path = p.dest.path;
    return (/^https?:\/\//i.test(path) ? '' : base()) + path + (p.dest.query.length ? '?' + p.dest.query.join('&') : '');
  }
  function assetTagged(m) {
    var p = assetParts(m);
    if (!p || !p.dest) return '';
    return assetPath(p) + assetParams(p).map(function (x) { return x[0] + x[1]; }).join('');
  }
  // image shown in the output: full URLs as typed, bare names resolved against the torrid CDN
  function assetImgSrc(raw) {
    raw = (raw || '').trim().split(/\s+/)[0];
    if (!raw) return '';
    if (!/^https?:\/\//i.test(raw)) raw = 'https://cdn.torrid.com/i/torrid/' + raw;
    return raw.indexOf('?') < 0 ? raw + '?w=350' : raw;
  }
  function updateAssetPreviews() {
    Array.prototype.forEach.call(document.querySelectorAll('.asset-preview'), function (el) {
      el.textContent = assetTagged(el.dataset.m) || '(add a destination link to see the tagged URL)';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.asset-img'), function (box) {
      var src = assetImgSrc((state.assets[box.dataset.m] || {}).img);
      if (box.dataset.src === src) return;
      box.dataset.src = src; box.innerHTML = '';
      if (!src) return;
      var img = document.createElement('img');
      img.className = 'img-fluid border rounded';
      img.alt = 'Asset preview';
      img.onerror = function () { box.innerHTML = '<div class="small text-danger">Could not load the asset image - check the URL.</div>'; };
      img.src = src;
      box.appendChild(img);
    });
  }

  // user typed/pasted/cleared a URL on a link: update the row, then refresh everything that depends on it
  function applyUrlEdit(id, value) {
    var r = state.rows.filter(function (x) { return x.id == id; })[0]; if (!r) return;
    var u = T.normalizeUrl(value), wasMissing = r.missing;
    r.flags =r.flags.filter(function (f) { return f !== 'Missing URL'; });
    if (!u) {
      r.missing = true; r.path = ''; r.query = []; r.flags.push('Missing URL');
    } else {
      r.missing = false; r.path = u.path; r.query = u.query;
      if (!r.catEdited) r.catName = T.defaultCatName(u.path);
    }
    var top = window.scrollY;
    if (wasMissing && !r.missing && state.missIdx >= 0) state.missIdx--; // the fixed one drops out; Next lands on its successor
    renderGroups(); renderWarnings(); renderTabs(); renderRows();
    window.scrollTo(0, top);
  }

  // Options that silently change the output get a visible note with a one-click way back
  function renderFilterNote() {
    var parts = [], hid = state.rows.filter(function (r) { return r.flags.some(function (f) { return /^Redirect|^Ended/.test(f); }); }).length;
    if ($('hideFlagged').checked && hid) parts.push('Hiding ' + hid + ' redirect' + (hid === 1 ? '' : 's') + ' / ended <button type="button" class="link-btn" data-opt="hideFlagged">Show</button>');
    if ($('fullUrl').checked) parts.push('Full URLs on <button type="button" class="link-btn" data-opt="fullUrl">Turn off</button>');
    $('filterNote').innerHTML = parts.join(' · ');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-opt]') : null; if (!b) return;
    $(b.dataset.opt).checked = false; renderRows();
  });

  function renderRows() {
    renderFilterNote();
    var rows = visible();
    if (!state.rows.length) { $('out').innerHTML = emptyHtml(); renderWrikePreview(); return; }
    if (!rows.length) { $('out').innerHTML = '<div class="text-muted">No links to show.</div>'; renderWrikePreview(); return; }
    var html = '';
    menusInOrder().forEach(function (m) {
      var mrows = rows.filter(function (r) { return r.menu === m; });
      if (!mrows.length) return;
      var miss = mrows.filter(function (r) { return r.missing; }).length;
      html += '<div class="nav-menu"><div class="nav-menu-title">' + esc(m) +
        (miss ? '<span class="miss-dot" title="' + miss + ' missing URL"></span>' : '') + '</div><div class="nav-cols">';
      state.order.forEach(function (k) {
        if (state.groups[k].menu !== m) return;
        var gr = mrows.filter(function (r) { return r.group === k; });
        if (!gr.length) return;
        html += '<div class="nav-sec"><div class="nav-sec-title' + (gr.some(function (r) { return r.missing; }) ? ' has-missing' : '') + '">' +
          esc(state.groups[k].section) + '</div><div class="nav-sec-cols">' +
          subcols(gr).map(function (col) { return '<div class="nav-col">' + col.map(itemHtml).join('') + '</div>'; }).join('') +
          '</div></div>';
      });
      html += '<div class="nav-asset"><div class="nav-sec-title">Asset</div>' +
        assetFieldsHtml(m, '') +
        '<div class="asset-preview" data-m="' + esc(m) + '">' + esc(assetTagged(m) || '(add a destination link to see the tagged URL)') + '</div>' +
        '<div class="asset-img mt-2" data-m="' + esc(m) + '"></div>' +
        '</div></div></div>';
    });
    $('out').innerHTML = html;
    updateAssetPreviews();
    renderWrikePreview();
  }

  /* ---------- Wrike table: one table per parent nav, one column per picked section (+ Asset) ---------- */
  function menusInOrder() {
    var m = [];
    state.order.forEach(function (k) { var x = state.groups[k].menu; if (m.indexOf(x) < 0) m.push(x); });
    return m;
  }
  function wrikeName(r) { return r.label + (r.isNew ? ' NEW' : ''); }

  function renderWrikeControls() {
    var menus = menusInOrder();
    if (!menus.length) {
      $('wrikeControls').innerHTML = emptyHtml(true);
      $('wrikePreview').innerHTML = ''; $('wrikeSummary').textContent = ''; $('wrikePreviewToggle').classList.add('d-none'); return;
    }
    // top row: tick a navigation to include its whole table below, untick to drop it
    var navRow = '<div class="wrike-nav mb-2"><div class="mb-1"><strong>Navigation</strong> <span class="text-muted small">(check to include)</span></div>' +
      '<div class="d-flex flex-wrap align-items-center gap-3">' +
      menus.map(function (m) {
        return '<label class="form-check-label"><input type="checkbox" class="form-check-input me-1 wnav" data-m="' + esc(m) + '" ' +
          (state.wrikeNavOff[m] ? '' : 'checked') + '>' + esc(m) + '</label>';
      }).join('') + '</div></div>';
    $('wrikeControls').innerHTML = navRow;
    renderWrikePreview();
  }

  // The table's columns for a menu, in nav order: every sheet block becomes one column.
  // Labels follow the Wrike layout: Featured | Column 2 (New) | Column 3 | ... | Asset
  function wrikeCols(m) {
    var hide = $('hideFlagged').checked, cols = [];
    var keep = function (r) { return !r.exclude && !(hide && r.flags.some(function (f) { return /^Redirect|^Ended/.test(f); })); };
    state.order.forEach(function (k) {
      if (state.groups[k].menu !== m) return;
      var sc = subcols(state.rows.filter(function (r) { return r.group === k; }));
      sc.forEach(function (col, i) {
        cols.push({ section: state.groups[k].section, first: i === 0, items: col.filter(keep) });
      });
    });
    return cols.map(function (c, i) {
      c.idx = i;
      c.title = c.first ? c.section : '';
      c.label = i === 0 ? c.section : 'Column ' + (i + 1) + (c.first ? ' (' + c.section + ')' : '');
      return c;
    });
  }

  // data for one menu (only the ticked columns / asset), or null when nothing is ticked
  function wrikeData(m) {
    if (state.wrikeNavOff[m]) return null;
    var cols = wrikeCols(m).filter(function (c) { return !state.wrikeOff[m + '#' + c.idx]; });
    var asset = state.wrikeOff[m + '#asset'] ? null : m;
    if (!cols.length && asset === null) return null;
    return { menu: m, asset: asset, cols: cols };
  }
  /* One link as it appears in Wrike (same shape as the content-sheet cell):
       Name (NEW FLAG)
       /path/            <- bold
       ?promo_id=...     <- values bold
       &promo_name=...
       &promo_creative=...
       &promo_position=...
       ID: data-category_name   <- highlighted */
  var ID_BG = '#b6e3fb';
  function wrikeParts(r) {
    var g = state.groups[r.group];
    var head = r.label + (r.isNew ? ' (NEW FLAG)' : '');
    if (r.missing) return { head: head, missing: true };
    var sep = r.query.length ? '&' : '?';
    return {
      head: head,
      path: (/^https?:\/\//i.test(r.path) ? '' : base()) + r.path + (r.query.length ? '?' + r.query.join('&') : ''),
      params: [[sep + 'promo_id=', g.id], ['&promo_name=', r.promoName], ['&promo_creative=', 'TextOnly'], ['&promo_position=', g.pos]],
      id: r.catName
    };
  }
  function wrikeItemHtml(r) {
    var p = wrikeParts(r);
    if (p.missing) return esc(p.head) + '<br><b style="color:#b02a37">MISSING URL</b>';
    return esc(p.head) + '<br><b>' + esc(p.path) + '</b>' +
      p.params.map(function (x) { return '<br>' + esc(x[0]) + '<b>' + esc(x[1]) + '</b>'; }).join('') +
      '<br><br><span style="background:' + ID_BG + '">ID: ' + esc(p.id) + '</span>';
  }
  function wrikeItemText(r) {
    var p = wrikeParts(r);
    if (p.missing) return p.head + '\nMISSING URL';
    return p.head + '\n' + p.path + '\n' + p.params.map(function (x) { return x[0] + x[1]; }).join('\n') + '\n\nID: ' + p.id;
  }
  // Asset cell: "Asset: <image url>" then the tagged destination link (promo_creative = asset file name)
  function wrikeAssetHtml(m) {
    var p = assetParts(m); if (!p) return '';
    var h = 'Asset:' + (p.img ? '<br>' + esc(p.img) : '');
    if (p.dest) {
      h += '<br><br><b>' + esc(assetPath(p)) + '</b>' +
        assetParams(p).map(function (x) { return '<br>' + esc(x[0]) + '<b>' + esc(x[1]) + '</b>'; }).join('');
    }
    return h;
  }
  function wrikeAssetText(m) {
    var p = assetParts(m); if (!p) return '';
    return 'Asset:' + (p.img ? '\n' + p.img : '') +
      (p.dest ? '\n\n' + assetPath(p) + '\n' + assetParams(p).map(function (x) { return x[0] + x[1]; }).join('\n') : '');
  }
  function tsvCell(v) { return /[\t\n"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  // table rows line up like the sheet: row i holds the i-th link of every column; asset sits on row 1
  function wrikeGrid(d, fmt) {
    var n = Math.max(1, Math.max.apply(null, d.cols.map(function (c) { return c.items.length; })));
    var rows = [];
    for (var i = 0; i < n; i++) {
      var cells = d.cols.map(function (c) { return c.items[i] ? fmt.item(c.items[i]) : ''; });
      if (d.asset !== null) cells.push(i === 0 ? fmt.asset(d.asset) : '');
      rows.push(cells);
    }
    return rows;
  }
  function wrikeHead(d) {
    return d.cols.map(function (c) { return c.title.toUpperCase(); }).concat(d.asset === null ? [] : ['ASSET']);
  }
  function wrikeTableHtml(d) {
    var rows = wrikeGrid(d, { item: wrikeItemHtml, asset: wrikeAssetHtml });
    return '<p><b style="color:#d6001c">' + esc(d.menu) + '</b></p>' +
      '<table class="wrike" border="1" cellpadding="6" style="border-collapse:collapse"><thead><tr>' +
      wrikeHead(d).map(function (h) { return '<th style="text-align:left;vertical-align:top;white-space:nowrap">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (cells) {
        return '<tr>' + cells.map(function (c) { return '<td style="vertical-align:top;white-space:nowrap">' + c + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  function wrikeTableText(d) {
    var rows = wrikeGrid(d, { item: wrikeItemText, asset: wrikeAssetText });
    return d.menu + '\n' + wrikeHead(d).map(tsvCell).join('\t') + '\n' +
      rows.map(function (cells) { return cells.map(tsvCell).join('\t'); }).join('\n');
  }
  function renderWrikePreview() {
    var ds = menusInOrder().map(wrikeData).filter(Boolean);
    $('wrikePreview').innerHTML = ds.map(function (d) {
      return '<div class="mb-4">' + wrikeTableHtml(d) + '</div>';
    }).join('') || '<div class="text-muted small">No sections selected.</div>';
    var links = ds.reduce(function (n, d) { return n + d.cols.reduce(function (m, c) { return m + c.items.length; }, 0); }, 0);
    $('wrikeSummary').textContent = ds.length ? ds.length + ' table' + (ds.length === 1 ? '' : 's') + ' · ' + links + ' links ready to copy' : '';
    $('wrikePreviewToggle').classList.toggle('d-none', !ds.length);
    wrikeLinks = links;
    updateExport();
  }

  // primary button shows the count; a note warns about links with no URL; the sticky bar mirrors both
  function updateExport() {
    var miss = missingRows().length;
    setBtnLabel($('copyWrikeAll'), wrikeLinks ? 'Copy ' + wrikeLinks + ' link' + (wrikeLinks === 1 ? '' : 's') + ' for Wrike' : 'Copy for Wrike');
    $('exportNote').innerHTML = miss ? '<a href="#" class="miss-link" id="exportMiss"><span class="status-dot"></span>' + miss + ' link' + (miss === 1 ? ' has' : 's have') + ' no URL</a>' +
      ' <span class="caption">&middot; "Copy URLs only" skips them</span>' : '';
    $('stickySummary').textContent = state.rows.length + ' links' + (miss ? ' · ' + miss + ' missing' : '');
    setBtnLabel($('stickyCopy'), wrikeLinks ? 'Copy ' + wrikeLinks : 'Copy');
  }

  /* ---------- empty state + sample data ---------- */
  var SAMPLE = [
    'TOPS', 'FEATURED', 'Link\tURL\tStart\tEnd\tOwner', 'New Arrivals\t/tops/new-arrivals/\t\t\tAlex',
    'Holiday Tops\t/tops/holiday/\t11/20/26\t\tAlex', 'Bestsellers\t/tops/bestsellers/', 'Shop All Sweaters\t', '',
    'DRESSES', 'FEATURED', 'Link\tURL\tStart\tEnd\tOwner', 'New Dresses\t/dresses/new/\t\t\tSam', 'Party Dresses\t/dresses/occasion/party/'
  ].join('\n');
  function emptyHtml(compact) {
    return '<div class="empty-state"><div class="fw-semibold mb-1">Nothing here yet</div>' +
      '<div class="small">Paste your nav content sheet in step 1' + (compact ? '' : ' and click Generate') + ', or try it with an example.</div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary" data-sample>Load sample data</button></div>';
  }
  function loadSample() { undoable('Sample data loaded', function () { $('sheet').value = SAMPLE; parse(); }); }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-sample]')) loadSample();
  });
  // briefly turn a button green with "Copied!" so the click visibly did something
  function flash(btn) {
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    clearTimeout(btn._ft);
    btn.textContent = 'Copied ✓'; btn.classList.add('copied');
    btn._ft = setTimeout(function () { btn.textContent = btn.dataset.label; btn.classList.remove('copied'); }, 1600);
  }
  function copyRich(html, text, msg, btn) {
    var ok = function () { toast(msg); flash(btn); };
    var fb = function () {
      var d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-9999px;top:0';
      d.innerHTML = html; document.body.appendChild(d);
      var rg = document.createRange(); rg.selectNodeContents(d);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
      document.execCommand('copy'); s.removeAllRanges(); d.remove(); ok();
    };
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })]).then(ok, fb);
    } else fb();
  }

  function selected() { return visible().filter(function (r) { return !r.exclude; }); }
  var COLS = ['Menu', 'Section', 'Label', 'URL', 'data-category_name', 'promo_id', 'promo_name', 'promo_creative', 'promo_position', 'Start', 'End', 'Owner', 'Flags'];
  function rowVals(r) {
    var g = state.groups[r.group];
    return [r.menu, r.section, r.label, link(r), r.catName, g.id, r.promoName, 'TextOnly', g.pos, r.start, r.end, r.owner, r.flags.join('; ')];
  }
  function toast(msg, undo) {
    var el = document.createElement('div');
    el.className = 'toast show align-items-center text-bg-dark border-0';
    el.innerHTML = '<div class="d-flex align-items-center"><div class="toast-body">' + esc(msg) + '</div>' +
      (undo ? '<button type="button" class="link-btn toast-undo me-2">Undo</button>' : '') + '</div>';
    if (undo) el.querySelector('.toast-undo').addEventListener('click', function () { el.remove(); undo(); });
    $('toast').appendChild(el); setTimeout(function () { el.remove(); }, undo ? 8000 : 2200);
  }
  function copy(text, msg, btn) {
    var done = function () { toast(msg); flash(btn); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text) {
    var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t);
    t.select(); document.execCommand('copy'); t.remove();
  }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }

  /* ---------- events ---------- */
  function regenerate() { undoable('Regenerated · your edits were reset', parse); }
  $('parse').addEventListener('click', regenerate);
  $('sheet').addEventListener('paste', function () { setTimeout(regenerate, 50); });
  $('clear').addEventListener('click', function () {
    undoable('Sheet cleared', function () { $('sheet').value = ''; store('navTagger.sheet', ''); parse(); });
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('step1Body').classList.contains('d-none')) { e.preventDefault(); regenerate(); }
  });
  $('fullUrl').addEventListener('change', renderRows);
  $('hideFlagged').addEventListener('change', renderRows);

  $('step1Toggle').addEventListener('click', function () {
    setStep1(!$('step1Body').classList.contains('d-none'));
  });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'confirmAll') {
      state.order.forEach(function (k) { state.groups[k].confirmed = true; });
      renderGroups(); renderWarnings(); toast('All guesses confirmed');
      return;
    }
    if (t.id === 'openConfirm') { // reveal the guessed fields instead of confirming blind
      var d = $('groupsDetails'); d.open = true;
      d.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var a = t.closest ? t.closest('a.miss-link') : null; if (!a) return;
    e.preventDefault();
    var miss = missingRows(); if (!miss.length) return;
    var r;
    if (a.id === 'nextMiss') { state.missIdx = (state.missIdx + 1) % miss.length; r = miss[state.missIdx]; }
    else { r = miss[0]; state.missIdx = 0; } // from the export note: start at the first
    renderWarnings();
    if (state.menu !== 'ALL' && state.menu !== r.menu) state.menu = r.menu;
    $('hideFlagged').checked = false;
    renderTabs(); renderRows();
    var row = $('out').querySelector('.nav-item-row[data-rid="' + r.id + '"]'); if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    var inp = row.querySelector('.url-edit'); if (inp) inp.focus({ preventScroll: true });
    setTimeout(function () { row.classList.remove('flash'); }, 1700);
  });
  $('out').addEventListener('click', function (e) {
    var mv = e.target.closest('.mv-up, .mv-down');
    if (mv) { // keyboard / touch alternative to drag & drop: swap with the neighbour in the same column
      var cur = mv.closest('.nav-item-row'), up = mv.classList.contains('mv-up');
      var nb = up ? cur.previousElementSibling : cur.nextElementSibling;
      if (!nb || !nb.classList.contains('nav-item-row')) { toast(up ? 'Already first in this column' : 'Already last in this column'); return; }
      var id = cur.dataset.rid, cls = up ? '.mv-up' : '.mv-down';
      moveRow(id, nb.dataset.rid, !up);
      var top = window.scrollY;
      renderRows(); renderWrikeControls();
      window.scrollTo(0, top);
      var again = $('out').querySelector('.nav-item-row[data-rid="' + id + '"]');
      if (again) { again.classList.add('open'); var ch = again.querySelector('.url-toggle'); if (ch) { ch.innerHTML = '&#9662;'; ch.setAttribute('aria-expanded', 'true'); } var nbtn = again.querySelector(cls); if (nbtn) nbtn.focus({ preventScroll: true }); }
      return;
    }
    var b = e.target.closest('.url-toggle'); if (!b) return;
    var row = b.closest('.nav-item-row');
    row.classList.toggle('open');
    var isOpen = row.classList.contains('open');
    b.innerHTML = isOpen ? '&#9662;' : '&#9656;';
    b.setAttribute('aria-expanded', String(isOpen));
  });
  $('menuTabs').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-menu]'); if (!a) return;
    e.preventDefault(); state.menu = a.dataset.menu; renderTabs(); renderRows();
  });

  // rename a navigation (e.g. "HOLIDAY TWO 2026_CONTENT PLAN MASTER" -> "New"): applies to all its sections
  // and links, and re-derives promo_position / name prefix from the new name unless you typed them yourself
  function renameMenu(oldName, newName) {
    newName = newName.trim();
    if (!newName || newName === oldName) { renderGroups(); return; }
    state.order.forEach(function (k) {
      var g = state.groups[k]; if (g.menu !== oldName) return;
      g.menu = newName;
      var d = T.groupDefaults(newName, g.section), man = g.manual || {};
      ['id', 'pos', 'namePrefix'].forEach(function (f) { if (!man[f]) g[f] = d[f]; });
      if (!man.pos) g.known = d.known;
    });
    state.rows.forEach(function (r) {
      if (r.menu !== oldName) return;
      r.menu = newName;
      if (!r.nameEdited) r.promoName = T.defaultPromoName(r.label, state.groups[r.group]);
    });
    [state.assets, state.wrikeNavOff].forEach(function (o) {
      if (oldName in o) { o[newName] = o[oldName]; delete o[oldName]; }
    });
    if (state.menu === oldName) state.menu = newName;
    renderGroups(); renderWarnings(); renderTabs(); renderRows(); renderWrikeControls();
  }
  $('groups').addEventListener('change', function (e) {
    if (e.target.dataset.mold !== undefined) renameMenu(e.target.dataset.mold, e.target.value);
  });
  $('groups').addEventListener('input', function (e) {
    var t = e.target; if (!t.dataset.g) return;
    var g = state.groups[t.dataset.g]; g[t.dataset.f] = t.value.trim();
    (g.manual = g.manual || {})[t.dataset.f] = true; // typed by hand: don't overwrite when a nav is renamed
    if (t.dataset.f === 'pos') g.known = true;
    if (t.dataset.f === 'namePrefix') {
      state.rows.forEach(function (r) {
        if (r.group === g.key && !r.nameEdited) r.promoName = T.defaultPromoName(r.label, g);
      });
    }
    renderRows();
  });

  $('out').addEventListener('input', function (e) {
    var t = e.target;
    if (t.classList.contains('wasset')) { onAssetInput(t); return; }
    if (!t.dataset.r) return;
    var r = state.rows.filter(function (x) { return x.id == t.dataset.r; })[0];
    r[t.dataset.f] = t.value.trim();
    if (t.dataset.f === 'catName') r.catEdited = true;
    if (t.dataset.f === 'promoName') r.nameEdited = true;
    if (!r.missing) $('u' + r.id).textContent = link(r);
    renderWrikePreview();
  });
  $('out').addEventListener('change', function (e) {
    var id = e.target.dataset.id, c = e.target.classList;
    if (c.contains('url-edit')) { applyUrlEdit(id, e.target.value); return; }
    if (!c.contains('inc') && !c.contains('isnew')) return;
    state.rows.forEach(function (r) {
      if (r.id != id) return;
      if (c.contains('inc')) r.exclude = !e.target.checked; else r.isNew = e.target.checked;
    });
    renderWrikePreview();
  });

  /* drag & drop (grab the ☰ handle): reorder inside a column or move to another column of the same nav.
     Order and column live on state.rows, so the Wrike table, copies and exports all follow. */
  var dragId = null;
  function clearDrop() {
    Array.prototype.forEach.call($('out').querySelectorAll('.drop-above, .drop-below'), function (el) {
      el.classList.remove('drop-above', 'drop-below');
    });
  }
  function moveRow(fromId, toId, after) {
    var rows = state.rows, i, from = -1;
    for (i = 0; i < rows.length; i++) if (rows[i].id == fromId) { from = i; break; }
    if (from < 0) return null;
    var moved = rows.splice(from, 1)[0], to = -1;
    for (i = 0; i < rows.length; i++) if (rows[i].id == toId) { to = i; break; }
    if (to < 0) { rows.splice(from, 0, moved); return null; }
    rows.splice(after ? to + 1 : to, 0, moved);
    return moved;
  }
  // Where would the dragged link land? Over a link: above/below it. Over a column's empty space: end of that
  // column. Allowed anywhere inside the same parent nav (e.g. Featured -> a New column), not across navs.
  function dropTarget(e) {
    if (dragId === null || !e.target.closest) return null;
    var col = e.target.closest('.nav-col'); if (!col) return null;
    var src = $('out').querySelector('.nav-item-row[data-rid="' + dragId + '"]');
    if (!src || src.closest('.nav-menu') !== col.closest('.nav-menu')) return null;
    var row = e.target.closest('.nav-item-row');
    if (row) {
      if (row === src) return null;
      var r = row.getBoundingClientRect();
      return { row: row, after: e.clientY > r.top + r.height / 2 };
    }
    var items = col.querySelectorAll('.nav-item-row'), last = items[items.length - 1];
    return last && last !== src ? { row: last, after: true } : null;
  }
  $('out').addEventListener('mousedown', function (e) {
    var h = e.target.closest('.drag-handle'); if (!h) return;
    h.closest('.nav-item-row').draggable = true;
  });
  $('out').addEventListener('mouseup', function () {
    Array.prototype.forEach.call($('out').querySelectorAll('.nav-item-row[draggable="true"]'), function (r) { r.draggable = false; });
  });
  $('out').addEventListener('dragstart', function (e) {
    var row = e.target.closest ? e.target.closest('.nav-item-row') : null;
    if (!row) return;
    dragId = row.dataset.rid;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
    row.classList.add('dragging');
  });
  $('out').addEventListener('dragover', function (e) {
    var t = dropTarget(e); if (!t) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    clearDrop(); t.row.classList.add(t.after ? 'drop-below' : 'drop-above');
  });
  $('out').addEventListener('drop', function (e) {
    var t = dropTarget(e); if (!t) return;
    e.preventDefault();
    var id = dragId, toId = t.row.dataset.rid; dragId = null; clearDrop();
    var moved = moveRow(id, toId, t.after);
    if (moved) {
      // landing in another column: take on that column's section, sheet block and tagging group
      var tgt = state.rows.filter(function (x) { return x.id == toId; })[0];
      if (tgt && moved.group !== tgt.group) {
        moved.group = tgt.group; moved.section = tgt.section;
        if (!moved.nameEdited) moved.promoName = T.defaultPromoName(moved.label, state.groups[tgt.group]);
      }
      if (tgt) moved.blk = tgt.blk;
    }
    var top = window.scrollY;
    renderGroups(); renderRows(); renderWrikeControls();
    window.scrollTo(0, top);
  });
  $('out').addEventListener('dragend', function () {
    dragId = null; clearDrop();
    Array.prototype.forEach.call($('out').querySelectorAll('.dragging, [draggable="true"]'), function (r) {
      r.classList.remove('dragging'); r.draggable = false;
    });
  });

  /* Wrike controls */
  $('wrikeControls').addEventListener('input', function (e) {
    if (e.target.classList.contains('wasset')) onAssetInput(e.target);
  });
  $('wrikeControls').addEventListener('change', function (e) {
    if (e.target.classList.contains('wnav')) {
      state.wrikeNavOff[e.target.dataset.m] = !e.target.checked;
      renderWrikeControls();
      return;
    }
  });
  $('copyWrikeAll').addEventListener('click', function () {
    var ds = menusInOrder().map(wrikeData).filter(Boolean);
    if (!ds.length) { toast('Tick at least one navigation and column'); return; }
    copyRich(
      ds.map(wrikeTableHtml).join('<br>'),
      ds.map(wrikeTableText).join('\n\n'),
      ds.length + ' table(s) copied', $('copyWrikeAll'));
  });
  $('wrikePreviewToggle').addEventListener('click', function () {
    var show = $('wrikePreview').classList.contains('d-none');
    $('wrikePreview').classList.toggle('d-none', !show);
    this.textContent = show ? 'Hide Wrike preview' : 'Show Wrike preview';
    this.setAttribute('aria-expanded', String(show));
  });
  $('checkAll').addEventListener('change', function (e) {
    visible().forEach(function (r) { r.exclude = !e.target.checked; });
    renderRows();
  });

  $('copyTable').addEventListener('click', function () {
    var rows = selected();
    copy([COLS.join('\t')].concat(rows.map(function (r) { return rowVals(r).join('\t'); })).join('\n'), rows.length + ' rows copied', $('copyTable'));
  });
  $('stickyCopy').addEventListener('click', function () { $('copyWrikeAll').click(); });
  // slim bar stays reachable while reviewing; hides itself when the Export step is on screen (one primary button at a time)
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (en) {
      $('stickyBar').classList.toggle('show', !en[0].isIntersecting && state.rows.length > 0);
    }).observe($('step3'));
  }
  $('copyUrls').addEventListener('click', function () {
    var rows = selected();
    rows = rows.filter(function (r) { return !r.missing; });
    copy(rows.map(link).join('\n'), rows.length + ' URLs copied', $('copyTable'));
  });
  $('dlXlsx').addEventListener('click', function () {
    if (typeof ExcelJS === 'undefined') { toast('XLSX library failed to load (check internet connection)'); return; }
    var rows = selected();
    if (!rows.length) { toast('Nothing selected'); return; }
    var wb = T.buildWorkbook(ExcelJS, rows, state.groups, state.order, link);
    wb.xlsx.writeBuffer().then(function (buf) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      a.download = 'nav-tagging.xlsx'; a.click();
      toast(rows.length + ' rows exported');
    });
  });
  $('dlCsv').addEventListener('click', function () {
    var csv = [COLS.join(',')].concat(selected().map(function (r) { return rowVals(r).map(csvCell).join(','); })).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'nav-tagging.csv'; a.click();
    toast('CSV downloaded');
  });

  /* "Detected groups" is now a "Show details" disclosure in the Review step (no splitter / nested scroll) */

  /* ---------- save / load ---------- */
  // Everything needed to pick up where you left off: pasted sheet, switches, every link with its edits
  // (URL, tags, NEW flag, include, order, column), group settings, assets and the Wrike navigation ticks.
  function snapshot() {
    return {
      app: 'navigation-tagger', version: 1, parser: T.PARSER_VERSION, savedAt: new Date().toISOString(),
      sheet: $('sheet').value, fullUrl: $('fullUrl').checked, hideFlagged: $('hideFlagged').checked,
      state: {
        rows: state.rows, groups: state.groups, order: state.order, menu: state.menu,
        wrikeOff: state.wrikeOff, wrikeNavOff: state.wrikeNavOff, assets: state.assets
      }
    };
  }
  function restore(snap) {
    if (!snap || snap.app !== 'navigation-tagger' || !snap.state || !Array.isArray(snap.state.rows)) {
      throw new Error('Not a Navigation Tagger project file');
    }
    var s = snap.state;
    $('sheet').value = snap.sheet || '';
    $('fullUrl').checked = !!snap.fullUrl; $('hideFlagged').checked = !!snap.hideFlagged;
    state.rows = s.rows; state.groups = s.groups || {}; state.order = s.order || [];
    state.menu = s.menu || 'ALL'; state.skipped = [];
    state.wrikeOff = s.wrikeOff || {}; state.wrikeNavOff = s.wrikeNavOff || {}; state.assets = s.assets || {};
    store('navTagger.sheet', $('sheet').value);
    renderGroups(); renderWarnings(); renderTabs(); renderRows(); renderWrikeControls();
    setStep1(state.rows.length > 0);
  }

  // autosave the whole session in the browser (debounced); reopening the page restores it
  var saveTimer = null;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var ok = store('navTagger.project', JSON.stringify(snapshot()));
      var note = $('autosaveNote');
      note.classList.remove('pending');
      note.classList.toggle('fail', !ok);
      note.textContent = ok ? 'Saved' : 'Not saved';
      if (!ok) { note.title = 'This browser blocked or filled its storage. Use Project > Save to file to keep your work.'; return; }
      note.title = 'Saved in this browser at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 500);
  }
  ['input', 'change', 'drop', 'click'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target && e.target.id === 'loadFile') return;
      autosave();
    });
  });

  $('saveProject').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
    a.download = 'nav-tagger-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    toast('Project saved to file');
  });
  $('loadProject').addEventListener('click', function () { $('loadFile').click(); });
  $('loadFile').addEventListener('change', function (e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { restore(JSON.parse(rd.result)); toast('Loaded ' + file.name); autosave(); }
      catch (err) { toast('Could not load: ' + err.message); }
    };
    rd.readAsText(file);
    e.target.value = '';
  });

  // reopen: restore the last auto-saved session, else just the last pasted sheet
  (function () {
    var proj = load('navTagger.project');
    // only restore a session made by the current parser; older ones are re-parsed from the saved sheet
    if (proj) { try { var snap = JSON.parse(proj); if (snap.parser === T.PARSER_VERSION) { restore(snap); return; } } catch (err) { /* fall through */ } }
    var saved = load('navTagger.sheet');
    if (saved) { $('sheet').value = saved; parse(); return; }
    renderRows(); renderWrikeControls(); setStep1(false); // first visit: show the empty state
  })();
})();
