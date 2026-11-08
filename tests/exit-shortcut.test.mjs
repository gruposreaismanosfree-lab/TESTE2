import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Usa o TypeScript já instalado no projeto, sem adicionar dependências de testes.
const source = await readFile(new URL('../src/lib/exit-shortcut.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { readExitShortcut, matchesExitShortcut, isEditingTarget } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const keyEvent = (overrides = {}) => ({ key: 'F8', repeat: false, defaultPrevented: false, isComposing: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...overrides });

test('preferência ausente ou inválida nunca ativa o atalho', () => {
  for (const value of [null, undefined, 1, 'F8', {}, { enabled: 'true', key: 'F8' }, { enabled: true, key: 'F10' }]) {
    assert.equal(readExitShortcut(value).enabled, false);
  }
});

test('preserva escolhas válidas F8 e F9', () => {
  for (const key of ['F8', 'F9']) {
    for (const enabled of [false, true]) assert.deepEqual(readExitShortcut({ key, enabled }), { key, enabled });
  }
});

test('aciona somente a tecla salva quando habilitada', () => {
  assert.equal(matchesExitShortcut(keyEvent(), { enabled: true, key: 'F8' }, false), true);
  assert.equal(matchesExitShortcut(keyEvent(), { enabled: true, key: 'F9' }, false), false);
  assert.equal(matchesExitShortcut(keyEvent({ key: 'F9' }), { enabled: true, key: 'F9' }, false), true);
  assert.equal(matchesExitShortcut(keyEvent(), { enabled: false, key: 'F8' }, false), false);
});

test('não intercepta edição, composição, repetição ou eventos já tratados', () => {
  const preference = { enabled: true, key: 'F8' };
  assert.equal(matchesExitShortcut(keyEvent(), preference, true), false);
  for (const flag of ['repeat', 'defaultPrevented', 'isComposing', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    assert.equal(matchesExitShortcut(keyEvent({ [flag]: true }), preference, false), false, flag);
  }
});

test('reconhece elementos protegidos e seus ancestrais pelo seletor', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  class TestElement {
    constructor(protectedTarget) { this.protectedTarget = protectedTarget; }
    closest(selector) {
      for (const part of ['input', 'textarea', 'select', 'form', '[contenteditable]', '[role="textbox"]', '.monaco-editor', '.cm-editor', '[data-ws-shortcuts="off"]']) assert.ok(selector.includes(part), part);
      return this.protectedTarget ? this : null;
    }
  }
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: TestElement });
  try {
    assert.equal(isEditingTarget(new TestElement(true)), true);
    assert.equal(isEditingTarget(new TestElement(false)), false);
    assert.equal(isEditingTarget(null), false);
    assert.equal(isEditingTarget({}), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'Element', original);
    else delete globalThis.Element;
  }
});
