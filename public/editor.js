import {
  cssColor, hexColor, textCss, shapeCss, mediaCss,
  scaleBox, patchBody, loadFonts,
} from '/public/editor-model.js';

const TEXT_TYPES = new Set(['text', 'kicker', 'cta', 'stamp']);
const MEDIA_TYPES = new Set(['photo', 'image']);
const FONTS = ['Bebas Neue', 'Space Grotesk', 'Poppins', 'Rozha One', 'Manrope', 'Inter', 'IBM Plex Mono'];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const fetchJson = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `request failed: ${res.status}`);
  return data;
};

let activeEditor = null;

export const openEditor = async (boardIdValue, projectId, assets = [], ctx = {}) => {
  if (!projectId) throw new Error('No project is open');
  if (activeEditor) activeEditor.close();
  document.querySelectorAll('.editor-wrap').forEach((node) => node.remove());
  const wrap = document.createElement('div');
  wrap.className = 'editor-wrap';
  wrap.innerHTML = `
    <div class="editor-modal" role="dialog" aria-modal="true">
      <div class="editor-bar">
        <button class="editor-btn" data-act="prev" title="Previous board">←</button>
        <button class="editor-btn" data-act="next" title="Next board">→</button>
        <span class="editor-title">Board <b data-board-name></b></span>
        <span class="editor-meta" data-meta></span>
        <span class="spacer"></span>
        <span class="editor-status" data-status></span>
        <button class="editor-btn" data-act="reload" title="Reload from server">Reload</button>
        <button class="editor-btn primary" data-act="close">Done</button>
      </div>
      <div class="editor-body">
        <div class="editor-stage-wrap"><div class="editor-stage" data-stage></div></div>
        <aside class="editor-inspector" data-inspector></aside>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const editor = new BoardEditor(wrap, boardIdValue, projectId, assets, ctx);
  activeEditor = editor;
  await editor.open();
  return editor;
};

class BoardEditor {
  constructor(wrap, boardIdValue, projectId, assets, ctx) {
    this.wrap = wrap;
    this.modal = wrap.querySelector('.editor-modal');
    this.stage = wrap.querySelector('[data-stage]');
    this.inspector = wrap.querySelector('[data-inspector]');
    this.statusEl = wrap.querySelector('[data-status]');
    this.boardId = boardIdValue;
    this.projectId = projectId;
    this.assets = assets;
    this.ctx = ctx;
    this.rows = new Map();
    this.nodes = new Map();
    this.selectedId = null;
    this.drag = null;
    this.thumbTimer = null;
    this.scale = 1;
    this.canvas = { w: 1080, h: 1920 };
    this.palette = {};
    this.scene = null;
    this.board = null;
    this.boards = [];
    this.boardIndex = 0;
    this.teardown = [];

    const onClick = (event) => {
      if (event.target === this.modal) this.close();
    };
    const onMove = (event) => this.onPointerMove(event);
    const onUp = (event) => this.onPointerUp(event);
    const onKey = (event) => this.onKeyDown(event);
    const onResize = () => { this.fitStage(); this.applyAllRows(); };
    this.modal.addEventListener('click', onClick);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    this.teardown.push(() => this.modal.removeEventListener('click', onClick));
    this.teardown.push(() => document.removeEventListener('pointermove', onMove));
    this.teardown.push(() => document.removeEventListener('pointerup', onUp));
    this.teardown.push(() => document.removeEventListener('pointercancel', onUp));
    this.teardown.push(() => document.removeEventListener('keydown', onKey));
    this.teardown.push(() => window.removeEventListener('resize', onResize));

    wrap.querySelector('[data-act="close"]').onclick = () => this.close();
    wrap.querySelector('[data-act="reload"]').onclick = () => this.open();
    wrap.querySelector('[data-act="prev"]').onclick = () => this.go(-1);
    wrap.querySelector('[data-act="next"]').onclick = () => this.go(1);
    this.buildSelection();
  }

  async open() {
    const cached = this.ctx.scene;
    if (cached?.boards?.some((item) => item.id === this.boardId)) {
      try {
        this.applyBundle({ scene: cached, palette: cached.palette });
        this.start();
        return;
      } catch (err) {
        this.inspector.innerHTML = `<div class="editor-error">${esc(err.message)}</div>`;
        this.setStatus(err.message, true);
        return;
      }
    }
    this.setStatus('Loading...');
    try {
      const data = await fetchJson(`/api/p/project/${this.projectId}`);
      this.applyBundle(data);
      this.start();
    } catch (err) {
      this.inspector.innerHTML = `<div class="editor-error">${esc(err.message)}</div>`;
      this.setStatus(err.message, true);
    }
  }

  applyBundle(data) {
    this.scene = data.scene;
    this.spec = data.spec;
    if (!this.scene || !Array.isArray(this.scene.boards) || !this.scene.boards.length) {
      throw new Error('Project has no storyboard scene');
    }
    this.boards = this.scene.boards;
    const found = this.boards.findIndex((item) => item.id === this.boardId);
    if (found < 0) throw new Error(`Board "${this.boardId}" not found`);
    this.boardIndex = found;
    this.board = this.boards[found];
    this.boardId = this.board.id;
    this.canvas = this.scene.canvas || { w: 1080, h: 1920 };
    this.palette = data.palette || this.scene.palette || {};
    this.scene.palette = this.palette;
    this.rows = new Map(this.board.elements.map((row) => [row.id, row]));
  }

  start() {
    this.renderStage();
    this.select(null);
    this.updateBar();
    this.setStatus('');
    const faces = { ...(this.scene.faces || {}) };
    FONTS.forEach((family, i) => { faces[`pick${i}`] = family; });
    loadFonts(faces).catch(() => {});
  }

  close() {
    if (this.thumbTimer) clearTimeout(this.thumbTimer);
    for (const off of this.teardown) off();
    this.teardown = [];
    this.wrap.remove();
    if (activeEditor === this) activeEditor = null;
    if (this.ctx.onClose) this.ctx.onClose();
  }

  destroy() {
    this.close();
  }

  go(delta) {
    const next = this.boardIndex + delta;
    if (next < 0 || next >= this.boards.length) return;
    const id = this.boards[next].id;
    this.close();
    openEditor(id, this.projectId, this.assets, this.ctx).catch((err) => console.error(err));
  }

  updateBar() {
    this.wrap.querySelector('[data-board-name]').textContent = this.boardId;
    this.wrap.querySelector('[data-meta]').textContent =
      `${this.canvas.w}x${this.canvas.h} · ${this.boardIndex + 1}/${this.boards.length}`;
    this.wrap.querySelector('[data-act="prev"]').disabled = this.boardIndex <= 0;
    this.wrap.querySelector('[data-act="next"]').disabled = this.boardIndex >= this.boards.length - 1;
  }

  setStatus(text, isError = false) {
    this.statusEl.textContent = text || '';
    this.statusEl.classList.toggle('err', Boolean(isError));
  }

  fitStage() {
    if (!this.stage || !this.stage.parentElement) return;
    const wrap = this.stage.parentElement;
    const availW = Math.max(220, wrap.clientWidth - 28);
    const availH = Math.max(260, wrap.clientHeight - 28);
    const scale = Math.min(availW / this.canvas.w, availH / this.canvas.h);
    this.scale = Math.max(0.05, scale);
    this.stage.style.width = `${Math.round(this.canvas.w * this.scale)}px`;
    this.stage.style.height = `${Math.round(this.canvas.h * this.scale)}px`;
  }

  renderStage() {
    this.stage.innerHTML = '';
    this.nodes.clear();
    this.fitStage();

    this.bgNode = document.createElement('div');
    this.bgNode.className = 'editor-bg';
    this.stage.appendChild(this.bgNode);
    this.stage.appendChild(this.selection);
    this.applyBackground();

    const background = this.scene.background || {};
    for (const blob of background.blobs || []) {
      const node = document.createElement('div');
      node.className = 'editor-blob';
      const r = Number(blob.r ?? 80);
      node.style.left = `${(Number(blob.x ?? 0) - r) * this.scale}px`;
      node.style.top = `${(Number(blob.y ?? 0) - r) * this.scale}px`;
      node.style.width = `${r * 2 * this.scale}px`;
      node.style.height = `${r * 2 * this.scale}px`;
      node.style.background = cssColor(blob.fill ?? blob.color ?? 'accent', this.palette);
      node.style.opacity = String(blob.opacity ?? 0.16);
      node.style.filter = `blur(${Math.max(0, Number(blob.blur ?? 30)) * this.scale}px)`;
      this.stage.appendChild(node);
    }

    for (const row of this.board.elements) this.renderRow(row, false);
    for (const row of this.scene.chrome || []) this.renderRow(row, true);
  }

  applyBackground() {
    if (!this.bgNode) return;
    const background = this.scene.background || {};
    const top = cssColor(background.top ?? this.palette.bg ?? '#000000', this.palette);
    const bottom = cssColor(background.bottom ?? this.palette.bg ?? '#000000', this.palette);
    this.bgNode.style.background = `linear-gradient(180deg, ${top}, ${bottom})`;
  }

  cssFor(row) {
    if (TEXT_TYPES.has(row.type)) return textCss(row, this.scale, this.palette, this.scene.faces);
    if (MEDIA_TYPES.has(row.type)) return mediaCss(row, this.scale, this.palette);
    const css = shapeCss(row, this.scale, this.palette);
    if (row.type === 'circle') css.borderRadius = '50%';
    return css;
  }

  renderRow(row, readonly) {
    const node = document.createElement('div');
    node.className = `editor-el type-${row.type}${readonly ? ' chrome' : ''}`;
    node.dataset.id = row.id;
    Object.assign(node.style, this.cssFor(row));
    node.style.zIndex = String(readonly ? 1000 + (row.z || 0) : 10 + (row.z || 0));
    node.style.pointerEvents = readonly ? 'none' : 'auto';
    node.classList.toggle('locked', Boolean(row.locked));
    node.classList.toggle('media', MEDIA_TYPES.has(row.type));

    if (TEXT_TYPES.has(row.type)) {
      const txt = document.createElement('span');
      txt.className = 'el-text';
      txt.textContent = row.text || '';
      node.appendChild(txt);
      this.applyTextExtras(node, row);
    }

    if (!readonly) {
      node.addEventListener('pointerdown', (event) => this.onNodePointerDown(event, row));
      node.addEventListener('dblclick', (event) => this.startTextEdit(event, row));
      node.addEventListener('dragover', (event) => event.preventDefault());
      node.addEventListener('drop', (event) => this.onDrop(event, row));
    }

    this.stage.insertBefore(node, this.selection);
    this.nodes.set(row.id, node);
  }

  applyTextExtras(node, row) {
    if (row.type === 'cta') {
      node.style.background = cssColor(row.fill ?? 'accent', this.palette);
      node.style.borderRadius = `${Math.max(4, Number(row.radius ?? 999)) * this.scale}px`;
      node.style.color = cssColor(row.textFill ?? 'bg', this.palette);
      node.style.display = 'flex';
      node.style.alignItems = 'center';
      node.style.justifyContent = 'center';
      node.style.padding = `${8 * this.scale}px ${14 * this.scale}px`;
    }
    if (row.type === 'stamp' && row.stroke) {
      node.style.border = `${Math.max(1, Number(row.strokeWidth ?? 2) * this.scale)}px solid ${cssColor(row.stroke, this.palette)}`;
    }
  }

  applyRow(row) {
    const node = this.nodes.get(row.id);
    if (!node) return;
    const css = this.cssFor(row);
    for (const key of Object.keys(css)) node.style[key] = css[key];
    node.style.zIndex = String(node.classList.contains('chrome') ? 1000 + (row.z || 0) : 10 + (row.z || 0));
    node.classList.toggle('locked', Boolean(row.locked));
    const txt = node.querySelector('.el-text');
    if (txt && txt !== document.activeElement) txt.textContent = row.text || '';
    this.applyTextExtras(node, row);
    if (this.selectedId === row.id) this.updateSelection();
  }

  applyAllRows() {
    if (!this.board) return;
    for (const row of this.board.elements) this.applyRow(row);
    for (const row of this.scene.chrome || []) this.applyRow(row);
    this.applyBackground();
  }

  buildSelection() {
    this.selection = document.createElement('div');
    this.selection.className = 'editor-selection';
    for (const corner of HANDLES) {
      const handle = document.createElement('div');
      handle.className = `editor-handle ${corner}`;
      handle.dataset.handle = corner;
      handle.addEventListener('pointerdown', (event) => this.onHandleDown(event, corner));
      this.selection.appendChild(handle);
    }
    const rotate = document.createElement('div');
    rotate.className = 'editor-handle rot';
    rotate.dataset.handle = 'rot';
    rotate.addEventListener('pointerdown', (event) => this.onHandleDown(event, 'rot'));
    this.selection.appendChild(rotate);
  }

  onHandleDown(event, corner) {
    const row = this.rows.get(this.selectedId);
    if (!row || row.locked) return;
    this.startDrag(event, row, corner === 'rot' ? 'rotate' : 'resize', corner);
  }

  onNodePointerDown(event, row) {
    if (event.target.closest('.editor-handle')) return;
    if (event.target.isContentEditable) return;
    if (row.locked) {
      this.select(row.id);
      return;
    }
    this.select(row.id);
    this.startDrag(event, row, 'move');
  }

  startDrag(event, row, mode, corner) {
    event.preventDefault();
    event.stopPropagation();
    this.drag = {
      mode, corner, row,
      sx: event.clientX, sy: event.clientY,
      x0: Number(row.x ?? 0), y0: Number(row.y ?? 0),
      w0: Number(row.w ?? 0), h0: Number(row.h ?? 0),
      size0: Number(row.size ?? 0), rot0: Number(row.rotation ?? 0),
      targetX: Number(row.x ?? 0), targetY: Number(row.y ?? 0),
      targetW: Number(row.w ?? 0), targetH: Number(row.h ?? 0),
      targetSize: Number(row.size ?? 0), targetRot: Number(row.rotation ?? 0),
      moved: false,
    };
  }

  onPointerMove(event) {
    if (!this.drag) return;
    const drag = this.drag;
    const dx = (event.clientX - drag.sx) / this.scale;
    const dy = (event.clientY - drag.sy) / this.scale;
    if (Math.abs(dx) + Math.abs(dy) > 1) drag.moved = true;
    const node = this.nodes.get(drag.row.id);
    if (!node) return;

    if (drag.mode === 'move') {
      const x = clamp(drag.x0 + dx, -drag.w0 * 0.8, this.canvas.w - drag.w0 * 0.2);
      const y = clamp(drag.y0 + dy, -drag.h0 * 0.8, this.canvas.h - drag.h0 * 0.2);
      drag.targetX = x;
      drag.targetY = y;
      node.style.transform = `translate(${(x - drag.x0) * this.scale}px, ${(y - drag.y0) * this.scale}px) rotate(${drag.rot0}deg)`;
      this.selection.style.transform = node.style.transform;
      return;
    }

    if (drag.mode === 'resize') {
      const corner = drag.corner;
      let x = drag.x0;
      let y = drag.y0;
      let w = drag.w0;
      let h = drag.h0;
      let size = drag.size0;
      if (corner.includes('e')) w = drag.w0 + dx;
      if (corner.includes('w')) { w = drag.w0 - dx; x = drag.x0 + dx; }
      if (corner.includes('s')) h = drag.h0 + dy;
      if (corner.includes('n')) { h = drag.h0 - dy; y = drag.y0 + dy; }
      w = Math.max(8, w);
      h = Math.max(8, h);
      if (TEXT_TYPES.has(drag.row.type) && (corner.includes('n') || corner.includes('s'))) {
        size = Math.max(4, drag.size0 * (h / Math.max(1, drag.h0)));
      }
      drag.targetX = x;
      drag.targetY = y;
      drag.targetW = w;
      drag.targetH = h;
      drag.targetSize = size;
      node.style.left = `${x * this.scale}px`;
      node.style.top = `${y * this.scale}px`;
      node.style.width = `${w * this.scale}px`;
      node.style.height = `${h * this.scale}px`;
      if (TEXT_TYPES.has(drag.row.type)) node.style.fontSize = `${Math.max(2, size * this.scale)}px`;
      this.updateSelectionBox(x, y, w, h, drag.rot0);
      return;
    }

    if (drag.mode === 'rotate') {
      const rect = this.stage.getBoundingClientRect();
      const cx = rect.left + (drag.x0 + drag.w0 / 2) * this.scale;
      const cy = rect.top + (drag.y0 + drag.h0 / 2) * this.scale;
      const angle = Math.atan2(event.clientY - cy, event.clientX - cx) * 180 / Math.PI + 90;
      drag.targetRot = Math.round(angle);
      node.style.transform = `rotate(${drag.targetRot}deg)`;
      this.selection.style.transform = node.style.transform;
    }
  }

  async onPointerUp() {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    const patch = {};
    if (drag.mode === 'move' && drag.moved) {
      patch.x = Math.round(drag.targetX);
      patch.y = Math.round(drag.targetY);
    } else if (drag.mode === 'resize') {
      patch.x = Math.round(drag.targetX);
      patch.y = Math.round(drag.targetY);
      patch.w = Math.round(drag.targetW);
      patch.h = Math.round(drag.targetH);
      if (TEXT_TYPES.has(drag.row.type)) patch.size = Math.round(drag.targetSize);
    } else if (drag.mode === 'rotate' && Math.round(drag.targetRot) !== Math.round(drag.rot0)) {
      patch.rotation = drag.targetRot;
    }
    if (Object.keys(patch).length) {
      await this.commit(drag.row, patch);
    } else {
      this.applyRow(drag.row);
      this.updateSelection();
    }
  }

  async commit(row, patch) {
    const before = { ...row };
    const serverPatch = { ...patch };
    if (serverPatch.x !== undefined) serverPatch.x = Math.round(serverPatch.x - Number(row.parentX ?? 0));
    if (serverPatch.y !== undefined) serverPatch.y = Math.round(serverPatch.y - Number(row.parentY ?? 0));
    Object.assign(row, patch);
    this.applyRow(row);
    this.updateSelection();
    try {
      const data = await fetchJson(`/api/p/project/${this.projectId}/element`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patchBody(row, serverPatch)),
      });
      const fresh = data.element;
      if (fresh) {
        Object.assign(row, fresh);
        this.rows.set(fresh.id, row);
        const at = this.board.elements.findIndex((item) => item.id === fresh.id);
        if (at >= 0) this.board.elements[at] = row;
        else this.board.elements.push(row);
        this.applyRow(row);
        this.updateSelection();
      }
      if (data.palette) this.palette = data.palette;
      this.renderInspector();
      this.setStatus('Saved');
      this.scheduleThumb();
    } catch (err) {
      Object.assign(row, before);
      this.applyRow(row);
      this.updateSelection();
      this.renderInspector();
      this.setStatus(err.message, true);
    }
  }

  scheduleThumb() {
    if (this.thumbTimer) clearTimeout(this.thumbTimer);
    this.thumbTimer = setTimeout(() => {
      if (this.ctx.refreshThumb) {
        this.ctx.refreshThumb(this.boardId).catch(() => {});
        return;
      }
      fetchJson(`/api/p/project/${this.projectId}/board/${this.boardId}/still`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      }).then((data) => {
        const img = document.querySelector(`[data-board="${this.boardId}"] img`);
        if (img && data.url) img.src = `${data.url}?t=${Date.now()}`;
      }).catch(() => {});
    }, 800);
  }

  select(id) {
    this.selectedId = id;
    this.stage.querySelectorAll('.editor-el.selected').forEach((node) => node.classList.remove('selected'));
    const node = id ? this.nodes.get(id) : null;
    if (node) node.classList.add('selected');
    this.updateSelection();
    this.renderInspector();
  }

  updateSelection() {
    const row = this.selectedId ? this.rows.get(this.selectedId) : null;
    if (!row) {
      this.selection.style.display = 'none';
      return;
    }
    this.selection.style.display = 'block';
    this.updateSelectionBox(row.x, row.y, row.w, row.h, row.rotation || 0);
  }

  updateSelectionBox(x, y, w, h, rotation) {
    this.selection.style.left = `${Number(x ?? 0) * this.scale}px`;
    this.selection.style.top = `${Number(y ?? 0) * this.scale}px`;
    this.selection.style.width = `${Math.max(1, Number(w ?? 0) * this.scale)}px`;
    this.selection.style.height = `${Math.max(1, Number(h ?? 0) * this.scale)}px`;
    this.selection.style.transform = `rotate(${Number(rotation ?? 0)}deg)`;
  }

  startTextEdit(event, row) {
    if (!TEXT_TYPES.has(row.type) || row.locked) return;
    event.preventDefault();
    event.stopPropagation();
    this.select(row.id);
    const node = this.nodes.get(row.id);
    const txt = node?.querySelector('.el-text');
    if (!txt) return;
    txt.contentEditable = 'true';
    txt.style.userSelect = 'text';
    txt.style.cursor = 'text';
    txt.focus();
    const range = document.createRange();
    range.selectNodeContents(txt);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    const onKey = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); txt.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); txt.textContent = row.text || ''; txt.blur(); }
    };
    const finish = async (save) => {
      txt.removeEventListener('keydown', onKey);
      txt.contentEditable = 'false';
      txt.style.userSelect = 'none';
      txt.style.cursor = '';
      const value = txt.textContent.replace(/\s+/g, ' ').trim();
      if (save && value && value !== row.text) await this.commit(row, { text: value });
      else this.applyRow(row);
    };
    txt.addEventListener('blur', () => finish(true), { once: true });
    txt.addEventListener('keydown', onKey);
  }

  onDrop(event, row) {
    event.preventDefault();
    if (row.locked || TEXT_TYPES.has(row.type)) return;
    const name = event.dataTransfer.getData('text/asset');
    if (name) this.commit(row, { assetName: name });
  }

  onKeyDown(event) {
    const tag = event.target?.tagName;
    if (event.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'Escape') {
      if (this.selectedId) this.select(null);
      else this.close();
      return;
    }
    if (!this.selectedId) return;
    const row = this.rows.get(this.selectedId);
    if (!row || row.locked) return;
    const step = event.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    this.commit(row, { x: Math.round(row.x + move[0]), y: Math.round(row.y + move[1]) });
  }

  renderInspector() {
    const row = this.selectedId ? this.rows.get(this.selectedId) : null;
    const palette = this.palettePanel();
    if (!row) {
      this.inspector.innerHTML = `<div class="editor-hint">Click an element. Drag to move. Handles resize. Top handle rotates. Double-click text to type.</div>${palette}`;
      this.bindPalette();
      return;
    }
    const isText = TEXT_TYPES.has(row.type);
    const isMedia = MEDIA_TYPES.has(row.type);
    const isShape = !isText && !isMedia;
    const swatches = ['ink', 'bg', 'accent', 'accent2', 'paper', 'muted']
      .filter((key) => this.palette[key])
      .map((key) => `<button class="editor-swatch" data-fill="${esc(key)}" title="${esc(key)}" style="background:${esc(cssColor(key, this.palette))}"></button>`)
      .join('');
    const assetOptions = (this.assets || []).map((asset) => `<option value="${esc(asset.name)}">${esc(asset.name)}</option>`).join('');
    this.inspector.innerHTML = `
      <div class="editor-head"><b>${esc(row.type)}</b><span>${esc(row.id)}</span></div>
      ${isText ? `<label class="editor-field"><span class="editor-label">Text</span><textarea data-k="text">${esc(row.text || '')}</textarea></label>` : ''}
      <div class="editor-grid">
        ${this.numberField('x', 'X', row.x)}
        ${this.numberField('y', 'Y', row.y)}
        ${this.numberField('w', 'W', row.w)}
        ${this.numberField('h', 'H', row.h)}
      </div>
      <div class="editor-grid">
        ${isText ? this.numberField('size', 'Size', row.size) : ''}
        ${this.numberField('rotation', 'Rotation', row.rotation)}
        ${this.numberField('opacity', 'Opacity', row.opacity, 0.05)}
      </div>
      ${isText ? `
        <label class="editor-field"><span class="editor-label">Face</span><select data-k="face">${FONTS.map((font) => `<option${font === row.face ? ' selected' : ''}>${esc(font)}</option>`).join('')}</select></label>
        <div class="editor-grid">
          <label class="editor-field"><span class="editor-label">Align</span><select data-k="align">${['left', 'center', 'right'].map((v) => `<option${v === row.align ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
          ${this.numberField('lineHeight', 'Line', row.lineHeight, 0.05)}
        </div>
        <label class="editor-field"><span class="editor-label">Color</span><input data-k="fill" type="color" value="${esc(hexColor(row.fill, this.palette, '#ffffff'))}"><div class="editor-swatches">${swatches}</div></label>
      ` : ''}
      ${isShape ? `
        <label class="editor-field"><span class="editor-label">Fill</span><input data-k="fill" type="color" value="${esc(hexColor(row.fill, this.palette, '#ffffff'))}"><div class="editor-swatches">${swatches}</div></label>
        <div class="editor-grid">
          ${this.numberField('radius', 'Radius', row.radius)}
          ${this.numberField('strokeWidth', 'Stroke', row.strokeWidth)}
        </div>
        <label class="editor-field"><span class="editor-label">Stroke color</span><input data-k="stroke" type="color" value="${esc(hexColor(row.stroke, this.palette, '#000000'))}"></label>
      ` : ''}
      ${isMedia ? `
        <label class="editor-field"><span class="editor-label">Swap asset</span><select data-k="assetName"><option value="">— keep —</option>${assetOptions}</select></label>
        <label class="editor-field"><span class="editor-label">Fit</span><select data-k="fit">${['cover', 'contain'].map((v) => `<option${v === row.fit ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      ` : ''}
      <label class="editor-lock"><input data-k="locked" type="checkbox" ${row.locked ? 'checked' : ''}> Lock element</label>
      <p class="editor-hint">Changes save on release or blur. Only this element is updated.</p>
      ${palette}`;
    this.bindInspector(row);
    this.bindPalette();
  }

  numberField(key, label, value, step = 1) {
    return `<label class="editor-field"><span class="editor-label">${esc(label)}</span><input data-k="${key}" type="number" step="${step}" value="${Math.round(Number(value ?? 0) * 100) / 100}"></label>`;
  }

  bindInspector(row) {
    this.inspector.querySelectorAll('[data-k]').forEach((input) => {
      input.addEventListener('change', () => this.onInspectorChange(row, input));
    });
    this.inspector.querySelectorAll('[data-fill]').forEach((button) => {
      button.addEventListener('click', () => this.commit(row, { fill: button.dataset.fill }));
    });
  }

  onInspectorChange(row, input) {
    const key = input.dataset.k;
    if (key === 'assetName') { if (input.value) this.commit(row, { assetName: input.value }); return; }
    if (key === 'locked') { this.commit(row, { locked: input.checked }); return; }
    if (key === 'text') { this.commit(row, { text: input.value }); return; }
    if (key === 'fill' || key === 'stroke') { this.commit(row, { [key]: input.value }); return; }
    if (key === 'face' || key === 'align' || key === 'fit') { this.commit(row, { [key]: input.value }); return; }
    const value = Number(input.value);
    if (Number.isFinite(value)) this.commit(row, { [key]: value });
  }

  palettePanel() {
    const keys = ['bg', 'ink', 'accent', 'accent2', 'paper', 'muted'].filter((key) => this.palette[key]);
    if (!keys.length) return '';
    return `<div class="editor-palette"><div class="editor-head"><b>Board colors</b><span>palette</span></div>
      <div class="editor-palette-grid">${keys.map((key) => `
        <label class="editor-field"><span class="editor-label">${esc(key)}</span>
          <input data-pal="${esc(key)}" type="color" value="${esc(hexColor(key, this.palette, '#000000'))}">
        </label>`).join('')}
      </div></div>`;
  }

  bindPalette() {
    this.inspector.querySelectorAll('[data-pal]').forEach((input) => {
      input.addEventListener('change', () => this.patchPalette(input.dataset.pal, input.value));
    });
  }

  async patchPalette(key, value) {
    try {
      const data = await fetchJson(`/api/p/project/${this.projectId}/palette`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ palette: { [key]: value } }),
      });
      this.palette = data.palette || this.palette;
      this.scene.palette = this.palette;
      if (key === 'bg') {
        this.scene.background = { ...(this.scene.background || {}), top: value, bottom: value };
      }
      this.applyAllRows();
      this.renderInspector();
      this.setStatus('Palette saved');
      this.scheduleThumb();
    } catch (err) {
      this.setStatus(err.message, true);
    }
  }
}
