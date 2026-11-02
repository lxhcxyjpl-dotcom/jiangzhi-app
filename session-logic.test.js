const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'app/index.html'), 'utf8');
const logic = html.split('/* SESSION_LOGIC_START */')[1].split('/* SESSION_LOGIC_END */')[0];
const ctx = {};
vm.runInNewContext(logic, ctx);

test('completion defaults respect progress and early stop reason', () => {
  assert.equal(ctx.defaultPointDone('advanced', ''), true);
  for (const progress of ['stuck', 'both']) assert.equal(ctx.defaultPointDone(progress, ''), false);
  for (const reason of ['distracted', 'tired', 'interrupted']) assert.equal(ctx.defaultPointDone('advanced', reason), false);
  assert.equal(ctx.defaultPointDone('advanced', 'done_early'), true);
});

test('evidence requires an explicitly filled progress note', () => {
  assert.equal(ctx.canSaveEvidence(''), false);
  assert.equal(ctx.canSaveEvidence('  \n'), false);
  assert.equal(ctx.canSaveEvidence('完成了一道题'), true);
});

test('duration uses actual end, including overtime and early completion, with legacy fallback', () => {
  assert.equal(ctx.sessionMinutes({startAt: 1000, endAt: 61000, actualEnd: 121000}), 2);
  assert.equal(ctx.sessionMinutes({startAt: 1000, endAt: 121000, actualEnd: 31000}), 0.5);
  assert.equal(ctx.sessionMinutes({startAt: 1000, endAt: 61000}), 1);
});

test('saving a review retains the selected point state and rejects empty evidence in both windows', () => {
  const submit = html.slice(html.indexOf('function submitReviewFrom('), html.indexOf('/* ============ 记录操作'));
  for (const which of ['main', 'widget']) {
    const point = {done: true};
    const fields = { 'input[name=progress]:checked': {value:'stuck'}, 'input[name=pointDone]:checked': {value:'no'}, 'input[id=evCheck]': {checked:true}, 'textarea[name=progressNote]': {value:'  '} };
    const root = {querySelector: selector => fields[selector] || null};
    const state = {currentSession: {pointId:'p', actualEnd:121000, startAt:1000, endAt:61000}, sessions:[], points:[], evidence:[]};
    const scope = { ...ctx, S:state, $:()=>root, pointById:()=>point, persist(){}, renderAll(){}, closeModal(){}, tourResume(){}, toast(){}, Date };
    vm.runInNewContext(submit, scope);
    scope.submitReviewFrom(which);
    assert.equal(point.done, false);
    assert.equal(state.sessions.length, 1);
    assert.equal(state.sessions[0].review.progressNote, '');
    assert.equal(state.evidence.length, 0);
    assert.equal(ctx.sessionMinutes(state.sessions[0]), 2);
  }
});
