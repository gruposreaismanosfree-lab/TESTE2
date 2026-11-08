import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/research.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
const { buildResearchPrompt } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const base = { topic: ' Fotossíntese ', subject: 'Biologia', depth: 'balanced', format: 'topics', notes: '' };

test('inclui tema normalizado, matéria, formato e profundidade', () => {
  const prompt = buildResearchPrompt(base);
  assert.ok(prompt.includes('Tema: Fotossíntese\n'));
  assert.ok(prompt.includes('Matéria: Biologia'));
  assert.ok(prompt.includes('Tópicos organizados'));
  assert.ok(prompt.includes('Intermediária:'));
});

test('não alega busca ou resposta pronta e orienta a não inventar referências', () => {
  const prompt = buildResearchPrompt(base);
  assert.ok(prompt.includes('não invente fontes ou citações'));
  assert.ok(prompt.includes('Não afirme ter pesquisado na internet'));
});

test('recusa tema vazio e tamanhos excedidos', () => {
  assert.throws(() => buildResearchPrompt({ ...base, topic: '   ' }), /tema/);
  assert.throws(() => buildResearchPrompt({ ...base, topic: 'x'.repeat(241) }), /240/);
  assert.throws(() => buildResearchPrompt({ ...base, subject: 'x'.repeat(81) }), /80/);
  assert.throws(() => buildResearchPrompt({ ...base, notes: 'x'.repeat(6001) }), /6.000/);
});

test('conclusão exige material do trabalho', () => {
  assert.throws(() => buildResearchPrompt({ ...base, format: 'conclusion' }), /principais resultados/);
  assert.ok(buildResearchPrompt({ ...base, format: 'conclusion', notes: 'O experimento demonstrou crescimento na presença de luz.' }).includes('O experimento demonstrou'));
});

test('recusa formatos inválidos inclusive propriedades herdadas', () => {
  assert.throws(() => buildResearchPrompt({ ...base, format: 'toString' }), /válidos/);
  assert.throws(() => buildResearchPrompt({ ...base, depth: 'unknown' }), /válidos/);
});

test('todos os formatos e profundidades cabem no limite do assistente', () => {
  for (const format of ['topics', 'essay', 'introduction', 'conclusion']) {
    for (const depth of ['brief', 'balanced', 'detailed']) {
      const prompt = buildResearchPrompt({ topic: 'x'.repeat(240), subject: 'x'.repeat(80), notes: 'x'.repeat(6000), format, depth });
      assert.ok(prompt.length <= 12000);
    }
  }
});
