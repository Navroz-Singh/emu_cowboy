#!/usr/bin/env python3
"""
Context Harvester - Select files from your project and bundle them for AI context.
Run: python context_harvester.py [optional: path/to/project]
"""

import os
import sys
import json
import threading
import webbrowser
import http.server
import urllib.parse
from pathlib import Path

# Default ignored directories
IGNORED_DIRS = {'.git', 'node_modules', '__pycache__', '.next', 'dist', 'build',
                '.venv', 'venv', '.env', '.idea', '.vscode', 'coverage', '.cache',
                'out', '.nuxt', '.output', 'vendor', '.pytest_cache', '.mypy_cache'}

ROOT_DIR = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()

def get_tree(path: Path, rel_base: Path):
    entries = []
    try:
        items = sorted(path.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
    except PermissionError:
        return entries
    for item in items:
        if item.name.startswith('.') and item.name not in ('.env',):
            continue
        if item.is_dir() and item.name in IGNORED_DIRS:
            continue
        rel = str(item.relative_to(rel_base))
        if item.is_dir():
            children = get_tree(item, rel_base)
            entries.append({'name': item.name, 'path': rel, 'type': 'dir', 'children': children})
        else:
            entries.append({'name': item.name, 'path': rel, 'type': 'file'})
    return entries

def read_files(paths, extensions, root):
    allowed_ext = {e.strip().lstrip('.').lower() for e in extensions if e.strip()}
    chunks = []
    for rel_path in paths:
        full = root / rel_path
        if not full.is_file():
            continue
        suffix = full.suffix.lstrip('.').lower()
        if allowed_ext and suffix not in allowed_ext:
            continue
        try:
            content = full.read_text(encoding='utf-8', errors='replace')
            chunks.append(f"// FILE: /{rel_path}\n{content}")
        except Exception as e:
            chunks.append(f"// FILE: /{rel_path}\n// ERROR reading file: {e}")
    return ('\n' * 15).join(chunks)

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Context Harvester</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #111118;
    --surface2: #1a1a24;
    --border: #2a2a3a;
    --accent: #7c6aff;
    --accent2: #ff6a9b;
    --text: #e8e8f0;
    --muted: #666688;
    --file: #a0e4b8;
    --dir: #ffd080;
    --success: #4ade80;
  }

  body {
    font-family: 'JetBrains Mono', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 1fr;
  }

  header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 1.3rem;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }

  .root-path {
    font-size: 0.7rem;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .ext-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .ext-label {
    font-size: 0.65rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }

  #ext-input {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.35rem 0.75rem;
    color: var(--text);
    font-family: inherit;
    font-size: 0.75rem;
    width: 260px;
    transition: border-color 0.2s;
    outline: none;
  }
  #ext-input:focus { border-color: var(--accent); }
  #ext-input::placeholder { color: var(--muted); }

  .main {
    display: grid;
    grid-template-columns: minmax(280px, 380px) 1fr;
    height: calc(100vh - 70px);
    overflow: hidden;
  }

  .sidebar {
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
  }

  .sidebar-header {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .sidebar-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }

  .select-btns {
    display: flex;
    gap: 0.5rem;
  }

  .mini-btn {
    font-family: inherit;
    font-size: 0.6rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--surface2);
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .mini-btn:hover { border-color: var(--accent); color: var(--accent); }

  .tree-scroll {
    overflow-y: auto;
    flex: 1;
    padding: 0.5rem 0;
  }
  .tree-scroll::-webkit-scrollbar { width: 4px; }
  .tree-scroll::-webkit-scrollbar-track { background: transparent; }
  .tree-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .tree-node { user-select: none; }

  .node-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.22rem 0.75rem;
    cursor: pointer;
    transition: background 0.1s;
    position: relative;
  }
  .node-row:hover { background: var(--surface2); }

  .indent { display: inline-block; width: 16px; flex-shrink: 0; }

  .toggle-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 0.55rem;
    transition: transform 0.15s;
  }
  .toggle-icon.open { transform: rotate(90deg); }
  .toggle-placeholder { width: 14px; flex-shrink: 0; }

  .node-check {
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--border);
    border-radius: 3px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    position: relative;
  }
  .node-check.checked { background: var(--accent); border-color: var(--accent); }
  .node-check.indeterminate { background: transparent; border-color: var(--accent); }
  .node-check.checked::after {
    content: '';
    width: 8px; height: 5px;
    border-left: 1.5px solid white;
    border-bottom: 1.5px solid white;
    transform: rotate(-45deg) translate(0.5px, -0.5px);
    position: absolute;
  }
  .node-check.indeterminate::after {
    content: '';
    width: 7px; height: 1.5px;
    background: var(--accent);
    position: absolute;
  }

  .node-icon { font-size: 0.75rem; flex-shrink: 0; }
  .node-name {
    font-size: 0.72rem;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .node-name.dir { color: var(--dir); }
  .node-name.file { color: var(--file); }

  .children-container { overflow: hidden; }
  .children-container.collapsed { display: none; }

  .preview-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
  }

  .preview-header {
    padding: 0.85rem 1.25rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    background: var(--surface);
  }

  .preview-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .count-badge {
    font-size: 0.68rem;
    padding: 0.2rem 0.6rem;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--muted);
  }
  .count-badge span { color: var(--accent); font-weight: 500; }

  .action-btns { display: flex; gap: 0.75rem; align-items: center; }

  .btn {
    font-family: inherit;
    font-size: 0.72rem;
    font-weight: 500;
    padding: 0.45rem 1rem;
    border-radius: 7px;
    border: none;
    cursor: pointer;
    transition: all 0.18s;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .btn-primary {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: white;
    box-shadow: 0 2px 12px rgba(124,106,255,0.35);
  }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(124,106,255,0.5); }
  .btn-primary:active { transform: translateY(0); }

  .btn-secondary {
    background: var(--surface2);
    border: 1px solid var(--border);
    color: var(--text);
  }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

  .btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .btn-ghost:hover { border-color: var(--border); color: var(--text); background: var(--surface2); }

  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }
  .preview-content::-webkit-scrollbar { width: 4px; }
  .preview-content::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .selected-file-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .selected-file-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.68rem;
    color: var(--muted);
    transition: border-color 0.15s;
  }
  .selected-file-chip:hover { border-color: var(--accent2); }
  .selected-file-chip .chip-path { color: var(--file); flex: 1; }
  .selected-file-chip .chip-remove {
    cursor: pointer;
    color: var(--muted);
    transition: color 0.15s;
    font-size: 0.85rem;
    line-height: 1;
  }
  .selected-file-chip .chip-remove:hover { color: var(--accent2); }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 0.75rem;
    color: var(--muted);
  }
  .empty-icon { font-size: 2.5rem; opacity: 0.3; }
  .empty-text { font-size: 0.75rem; text-align: center; line-height: 1.6; }

  .toast {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: var(--success);
    color: #0a0a0f;
    font-family: 'Syne', sans-serif;
    font-weight: 600;
    font-size: 0.8rem;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(74,222,128,0.4);
    transform: translateY(4rem);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
    z-index: 999;
    pointer-events: none;
  }
  .toast.show { transform: translateY(0); opacity: 1; }

  .status-bar {
    padding: 0.4rem 1.25rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    align-items: center;
    gap: 1.5rem;
    font-size: 0.62rem;
    color: var(--muted);
    flex-shrink: 0;
  }

  .status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--success);
    box-shadow: 0 0 6px var(--success);
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%,100% { opacity: 1; } 50% { opacity: 0.4; }
  }
</style>
</head>
<body>

<header>
  <div class="logo">⚡ Context Harvester</div>
  <div class="root-path" id="root-path-display"></div>
  <div class="ext-section">
    <span class="ext-label">Extensions</span>
    <input type="text" id="ext-input" placeholder="js, ts, py, jsx, tsx, css, html ..." value="js, ts, jsx, tsx, py, css, html, vue, svelte, go, rs, java, cpp, c, h">
  </div>
</header>

<div class="main">
  <div class="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">File Tree</span>
      <div class="select-btns">
        <button class="mini-btn" onclick="selectAll()">All</button>
        <button class="mini-btn" onclick="deselectAll()">None</button>
        <button class="mini-btn" onclick="expandAll()">Expand</button>
        <button class="mini-btn" onclick="collapseAll()">Collapse</button>
      </div>
    </div>
    <div class="tree-scroll" id="tree-container"></div>
  </div>

  <div class="preview-pane">
    <div class="preview-header">
      <div class="preview-meta">
        <span style="font-family:'Syne',sans-serif;font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted)">Selected Files</span>
        <span class="count-badge"><span id="file-count">0</span> <span id="file-count-label">files selected</span></span>
      </div>
      <div class="action-btns">
        <button class="btn btn-ghost" onclick="clearAll()">Clear</button>
        <button class="btn btn-secondary" onclick="previewOutput()">Preview Output</button>
        <button class="btn btn-primary" onclick="exportToFile()">⬇ Export to File</button>
        <button class="btn btn-primary" onclick="copyToClipboard()">⎘ Copy All</button>
      </div>
    </div>
    <div class="preview-content" id="preview-content">
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <div class="empty-text">Select files from the tree<br>to bundle them for AI context</div>
      </div>
    </div>
  </div>
</div>

<div class="status-bar">
  <div class="status-dot"></div>
  <span id="root-status">Loading...</span>
  <span>|</span>
  <span id="ext-status">Extensions: all</span>
</div>

<div class="toast" id="toast"></div>

<script>
let treeData = [];
let selectedPaths = new Set();
let nodeStates = {}; // path -> 'checked'|'indeterminate'|'unchecked'
let expandedDirs = new Set();

async function init() {
  const res = await fetch('/api/tree');
  const data = await res.json();
  treeData = data.tree;
  document.getElementById('root-path-display').textContent = data.root;
  document.getElementById('root-status').textContent = 'Root: ' + data.root;
  renderTree();
}

function getAllFiles(nodes) {
  let files = [];
  for (const n of nodes) {
    if (n.type === 'file') files.push(n.path);
    else if (n.children) files = files.concat(getAllFiles(n.children));
  }
  return files;
}

function getDirFiles(node) {
  return getAllFiles(node.children || []);
}

function computeState(node) {
  if (node.type === 'file') {
    return selectedPaths.has(node.path) ? 'checked' : 'unchecked';
  }
  const files = getDirFiles(node);
  if (files.length === 0) return 'unchecked';
  const sel = files.filter(f => selectedPaths.has(f)).length;
  if (sel === 0) return 'unchecked';
  if (sel === files.length) return 'checked';
  return 'indeterminate';
}

function toggleNode(node) {
  if (node.type === 'file') {
    if (selectedPaths.has(node.path)) selectedPaths.delete(node.path);
    else selectedPaths.add(node.path);
  } else {
    const files = getDirFiles(node);
    const state = computeState(node);
    if (state === 'checked') {
      files.forEach(f => selectedPaths.delete(f));
    } else {
      files.forEach(f => selectedPaths.add(f));
    }
  }
  renderTree();
  updatePreview();
}

function toggleExpand(path) {
  if (expandedDirs.has(path)) expandedDirs.delete(path);
  else expandedDirs.add(path);
  renderTree();
}

function renderTree() {
  const container = document.getElementById('tree-container');
  container.innerHTML = '';
  container.appendChild(renderNodes(treeData, 0));
}

function renderNodes(nodes, depth) {
  const frag = document.createDocumentFragment();
  for (const node of nodes) {
    frag.appendChild(renderNode(node, depth));
  }
  return frag;
}

function renderNode(node, depth) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'node-row';

  // Indent
  for (let i = 0; i < depth; i++) {
    const ind = document.createElement('span');
    ind.className = 'indent';
    row.appendChild(ind);
  }

  // Toggle icon (dirs only)
  if (node.type === 'dir') {
    const tog = document.createElement('span');
    tog.className = 'toggle-icon' + (expandedDirs.has(node.path) ? ' open' : '');
    tog.textContent = '▶';
    tog.addEventListener('click', e => { e.stopPropagation(); toggleExpand(node.path); });
    row.appendChild(tog);
  } else {
    const ph = document.createElement('span');
    ph.className = 'toggle-placeholder';
    row.appendChild(ph);
  }

  // Checkbox
  const state = computeState(node);
  const chk = document.createElement('div');
  chk.className = 'node-check ' + state;
  row.appendChild(chk);

  // Icon
  const ico = document.createElement('span');
  ico.className = 'node-icon';
  ico.textContent = node.type === 'dir' ? (expandedDirs.has(node.path) ? '📂' : '📁') : getFileIcon(node.name);
  row.appendChild(ico);

  // Name
  const nm = document.createElement('span');
  nm.className = 'node-name ' + node.type;
  nm.textContent = node.name;
  row.appendChild(nm);

  row.addEventListener('click', e => {
    if (e.target.classList.contains('toggle-icon')) return;
    toggleNode(node);
  });

  wrapper.appendChild(row);

  // Children
  if (node.type === 'dir' && node.children) {
    const childDiv = document.createElement('div');
    childDiv.className = 'children-container' + (expandedDirs.has(node.path) ? '' : ' collapsed');
    childDiv.appendChild(renderNodes(node.children, depth + 1));
    wrapper.appendChild(childDiv);
  }

  return wrapper;
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { js:'🟨',ts:'🔷',jsx:'⚛️',tsx:'⚛️',py:'🐍',css:'🎨',html:'🌐',
    json:'📋',md:'📝',vue:'💚',svelte:'🔶',go:'🐹',rs:'🦀',java:'☕',
    cpp:'⚙️',c:'⚙️',h:'⚙️',env:'🔑',yml:'📄',yaml:'📄',sh:'💻',
    png:'🖼️',jpg:'🖼️',svg:'🖼️',gif:'🖼️' };
  return icons[ext] || '📄';
}

function getExtensions() {
  return document.getElementById('ext-input').value.split(',').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean);
}

function fileMatchesExt(filePath, exts) {
  if (exts.length === 0) return true;
  const parts = filePath.split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop().toLowerCase();
  return exts.includes(ext);
}

function updatePreview() {
  const exts = getExtensions();
  const allSelected = [...selectedPaths].sort();
  const matched = allSelected.filter(p => fileMatchesExt(p, exts));
  const skipped = allSelected.filter(p => !fileMatchesExt(p, exts));

  // Update count badge
  const countEl = document.getElementById('file-count');
  const labelEl = document.getElementById('file-count-label');
  if (exts.length > 0 && skipped.length > 0) {
    countEl.innerHTML = `${matched.length}<span style="color:var(--muted);font-weight:300">/${allSelected.length}</span>`;
    labelEl.textContent = 'files match filter';
  } else {
    countEl.textContent = matched.length;
    labelEl.textContent = 'files selected';
  }

  const container = document.getElementById('preview-content');
  if (allSelected.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><div class="empty-text">Select files from the tree<br>to bundle them for AI context</div></div>`;
    return;
  }

  const wrapper = document.createElement('div');

  // Show extension filter summary if some are skipped
  if (exts.length > 0 && skipped.length > 0) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-bottom:0.75rem;padding:0.5rem 0.75rem;background:#1a1208;border:1px solid #5a3800;border-radius:6px;font-size:0.68rem;color:#ffaa44;display:flex;align-items:center;gap:0.5rem;';
    banner.innerHTML = `<span>⚠</span><span><b>${skipped.length}</b> file${skipped.length>1?'s':''} skipped — extension not in filter [${exts.join(', ')}]</span>`;
    wrapper.appendChild(banner);
  }

  const list = document.createElement('div');
  list.className = 'selected-file-list';

  // Render matched files first (normal), then skipped (dimmed)
  for (const p of matched) {
    list.appendChild(makeChip(p, false));
  }
  for (const p of skipped) {
    list.appendChild(makeChip(p, true));
  }

  wrapper.appendChild(list);
  container.innerHTML = '';
  container.appendChild(wrapper);
}

function makeChip(p, dimmed) {
  const chip = document.createElement('div');
  chip.className = 'selected-file-chip';
  if (dimmed) {
    chip.style.cssText = 'opacity:0.38;border-style:dashed;';
    chip.title = 'Skipped — extension not in filter';
  }
  const ext = p.includes('.') ? p.split('.').pop().toLowerCase() : '';
  chip.innerHTML = `<span>${dimmed ? '🚫' : '📄'}</span><span class="chip-path">${p}</span>${dimmed ? `<span style="font-size:0.6rem;color:var(--muted);white-space:nowrap">.${ext} filtered</span>` : ''}<span class="chip-remove" data-path="${p}">✕</span>`;
  chip.querySelector('.chip-remove').addEventListener('click', () => {
    selectedPaths.delete(p);
    renderTree();
    updatePreview();
  });
  return chip;
}

async function previewOutput() {
  if (selectedPaths.size === 0) { showToast('No files selected!'); return; }
  const exts = getExtensions();
  const res = await fetch('/api/content', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ paths: [...selectedPaths], extensions: exts })
  });
  const data = await res.json();
  const win = window.open('', '_blank');
  win.document.write(`<html><head><style>
    body{background:#0a0a0f;color:#e8e8f0;font-family:monospace;font-size:13px;padding:2rem;white-space:pre-wrap;word-wrap:break-word;}
  </style></head><body>${escapeHtml(data.content)}</body></html>`);
}

async function exportToFile() {
  if (selectedPaths.size === 0) { showToast('No files selected!'); return; }
  const exts = getExtensions();
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ paths: [...selectedPaths], extensions: exts })
  });
  const data = await res.json();
  if (data.ok) showToast('✓ Exported to ' + data.filename);
  else showToast('Error: ' + data.error);
}

async function copyToClipboard() {
  if (selectedPaths.size === 0) { showToast('No files selected!'); return; }
  const exts = getExtensions();
  const res = await fetch('/api/content', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ paths: [...selectedPaths], extensions: exts })
  });
  const data = await res.json();
  try {
    await navigator.clipboard.writeText(data.content);
    showToast('✓ Copied to clipboard!');
  } catch {
    showToast('Copy failed - try Export to File instead');
  }
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function selectAll() {
  getAllFiles(treeData).forEach(f => selectedPaths.add(f));
  renderTree(); updatePreview();
}

function deselectAll() {
  selectedPaths.clear();
  renderTree(); updatePreview();
}

function clearAll() { deselectAll(); }

function expandAll() {
  function addDirs(nodes) {
    for (const n of nodes) {
      if (n.type === 'dir') { expandedDirs.add(n.path); addDirs(n.children||[]); }
    }
  }
  addDirs(treeData); renderTree();
}

function collapseAll() { expandedDirs.clear(); renderTree(); }

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

document.getElementById('ext-input').addEventListener('input', () => {
  const exts = getExtensions();
  document.getElementById('ext-status').textContent = exts.length > 0
    ? 'Filter: ' + exts.map(e => '.'+e).join(', ')
    : 'Extensions: all files';
  updatePreview(); // live re-filter the preview panel
});

init();
</script>
</body>
</html>
"""

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif self.path == '/api/tree':
            tree = get_tree(ROOT_DIR, ROOT_DIR)
            payload = json.dumps({'tree': tree, 'root': str(ROOT_DIR)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_error(404)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length))

        if self.path == '/api/content':
            content = read_files(body['paths'], body.get('extensions', []), ROOT_DIR)
            payload = json.dumps({'content': content}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)

        elif self.path == '/api/export':
            try:
                content = read_files(body['paths'], body.get('extensions', []), ROOT_DIR)
                out_file = ROOT_DIR / 'context_bundle.txt'
                out_file.write_text(content, encoding='utf-8')
                payload = json.dumps({'ok': True, 'filename': str(out_file)}).encode()
            except Exception as e:
                payload = json.dumps({'ok': False, 'error': str(e)}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(payload)
        else:
            self.send_error(404)

def find_free_port():
    import socket
    with socket.socket() as s:
        s.bind(('', 0))
        return s.getsockname()[1]

if __name__ == '__main__':
    port = find_free_port()
    url = f'http://localhost:{port}'
    server = http.server.HTTPServer(('localhost', port), Handler)
    print(f'\n⚡ Context Harvester running at {url}')
    print(f'   Project root: {ROOT_DIR}')
    print(f'   Press Ctrl+C to stop\n')
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n✓ Server stopped.')