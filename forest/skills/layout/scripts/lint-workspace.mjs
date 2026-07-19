#!/usr/bin/env node
// Lint a Forest Admin workspace layout patch BEFORE sending it — the server does NOT
// validate spatial coherence or references (it 204s, then the front reflows / breaks at render).
//
// Usage:  node lint-workspace.mjs ops.json
// Input:  a layout patch — { "layout": [ { op:"add", path:"/workspaces/-", value:{...} }, ... ] }
//         (also accepts a bare workspace object, or { components:[...] }).
// Exit:   0 = clean, 1 = issues found (printed), 2 = bad input.

import { readFileSync } from 'node:fs';

const GRID_SOFT_WIDTH = 60; // design heuristic (≈1200px); server allows ~200 but wide = horizontal scroll
const NAME_RE = /^(?!currentUser$)[a-zA-Z0-9_-]{1,50}$/;

const file = process.argv[2];
if (!file) { console.error('usage: node lint-workspace.mjs <ops.json>'); process.exit(2); }

let data;
try { data = JSON.parse(readFileSync(file, 'utf8')); }
catch (e) { console.error('cannot read/parse', file, '-', e.message); process.exit(2); }

// Collect every workspace (with its components) from whatever shape we got.
function collectWorkspaces(d) {
  const out = [];
  const ops = d?.layout ?? (Array.isArray(d) ? d : null);
  if (Array.isArray(ops)) {
    for (const op of ops) {
      if (op?.path === '/workspaces/-' && op.value?.components) out.push(op.value);
      // a lone component add: wrap it so it still gets bounds/name checks
      if (/^\/workspaces\/[^/]+\/components\/-$/.test(op?.path ?? '') && op.value)
        out.push({ name: '(single component add)', components: [op.value] });
    }
  }
  if (d?.components) out.push(d);              // bare workspace object
  if (d?.value?.components) out.push(d.value); // bare op object
  return out;
}

const workspaces = collectWorkspaces(data);
if (!workspaces.length) { console.error('no workspace/components found in', file); process.exit(2); }

const overlaps = (a, b) => {
  const A = a.displaySettings, B = b.displaySettings;
  if (!A || !B) return false;
  return A.x < B.x + B.width && B.x < A.x + A.width && A.y < B.y + B.height && B.y < A.y + A.height;
};

let issues = 0;
const say = (ws, msg) => { issues++; console.log(`  ✗ [${ws.name ?? '?'}] ${msg}`); };

for (const ws of workspaces) {
  const comps = ws.components ?? [];
  const names = new Map(); // name -> comp
  const ids = new Set();
  for (const c of comps) { if (c.name) names.set(c.name, c); if (c.id) ids.add(c.id); }

  // names
  const seen = new Set();
  for (const c of comps) {
    if (!NAME_RE.test(c.name ?? '')) say(ws, `bad name "${c.name}" (need [a-zA-Z0-9_-], ≤50, ≠ currentUser)`);
    if (seen.has(c.name)) say(ws, `duplicate component name "${c.name}"`);
    seen.add(c.name);
  }

  // bounds + required keys
  for (const c of comps) {
    const d = c.displaySettings;
    if (d) {
      if (d.x < 0 || d.y < 0) say(ws, `${c.name}: x/y must be ≥ 0`);
      if (d.width < 1 || d.height < 1) say(ws, `${c.name}: width/height must be ≥ 1`);
      if (d.x + d.width > GRID_SOFT_WIDTH) say(ws, `${c.name}: right edge ${d.x + d.width} > ${GRID_SOFT_WIDTH} cols (horizontal scroll)`);
    }
    if (c.type === 'field' && !(c.options && 'fieldName' in c.options))
      say(ws, `${c.name}: field options must carry "fieldName" (send null with a path) → else 422`);
    if (c.type === 'chart' && !(c.options && 'description' in c.options))
      say(ws, `${c.name}: chart options must carry "description" (null ok) → else 422`);
  }

  // overlaps
  for (let i = 0; i < comps.length; i++)
    for (let j = i + 1; j < comps.length; j++)
      if (overlaps(comps[i], comps[j])) say(ws, `overlap: "${comps[i].name}" ∩ "${comps[j].name}" (front will reflow it down)`);

  // reference integrity
  for (const c of comps) {
    const o = c.options ?? {};
    // filter templates → reference a master by NAME with selectARecord
    const blob = JSON.stringify(o.filter ?? '');
    for (const m of blob.matchAll(/\{\{([A-Za-z0-9_-]+)\.selectedRecord/g)) {
      const master = names.get(m[1]);
      if (!master) say(ws, `${c.name}: filter references {{${m[1]}...}} but no component is named "${m[1]}"`);
      else if (master.options?.onRowClick !== 'selectARecord') say(ws, `${c.name}: master "${m[1]}" lacks onRowClick:"selectARecord"`);
    }
    // id references
    for (const key of ['sourceWorkspaceComponentId', 'componentToSelectRecordFromId']) {
      const v = o[key];
      if (v && v !== 'currentRecord' && !ids.has(v)) say(ws, `${c.name}: ${key} "${v}" is not an existing component id here`);
    }
    const childIds = [...(o.componentIds ?? []), ...((o.tabs ?? []).flatMap(t => t.componentIds ?? []))];
    for (const cid of childIds) if (!ids.has(cid)) say(ws, `${c.name}: componentIds references "${cid}" — no such component id`);
  }
}

if (issues) { console.log(`\n${issues} issue(s) — fix before sending (the server won't catch these).`); process.exit(1); }
console.log(`✓ ${workspaces.length} workspace(s) clean: bounds, no overlap, references & names OK.`);
process.exit(0);
