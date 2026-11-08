export const researchDraftKey = 'ws-study:research-draft:v1';
export const depths = { brief: 'Breve: apresente os conceitos essenciais com um exemplo.', balanced: 'Intermediária: desenvolva conceitos, relações e exemplos.', detailed: 'Aprofundada: explore conceitos, contrapontos, aplicações e limitações.' } as const;
export const formats = { topics: 'Tópicos organizados', essay: 'Texto com introdução, desenvolvimento e conclusão', introduction: 'Introdução de trabalho escolar', conclusion: 'Conclusão baseada no material fornecido' } as const;
export type ResearchInput = { topic: string; subject: string; depth: keyof typeof depths; format: keyof typeof formats; notes: string };

export function buildResearchPrompt(input: ResearchInput): string {
  const topic = input.topic.trim();
  const subject = input.subject.trim();
  const notes = input.notes.trim();
  if (!topic || topic.length > 240) throw new Error('Informe um tema com até 240 caracteres.');
  if (subject.length > 80) throw new Error('A matéria deve ter até 80 caracteres.');
  if (notes.length > 6000) throw new Error('O material de apoio deve ter até 6.000 caracteres.');
  if (!Object.prototype.hasOwnProperty.call(depths, input.depth) || !Object.prototype.hasOwnProperty.call(formats, input.format)) throw new Error('Selecione um formato e uma profundidade válidos.');
  if (input.format === 'conclusion' && !notes) throw new Error('Para criar uma conclusão, inclua o desenvolvimento ou os principais resultados do trabalho.');
  return [
    'Ajude-me a estudar e desenvolver o seguinte conteúdo escolar.',
    `Tema: ${topic}`,
    subject ? `Matéria: ${subject}` : '',
    `Formato: ${formats[input.format]}.`,
    `Profundidade: ${depths[input.depth]}`,
    notes ? `Material de apoio e orientações do trabalho:\n${notes}` : '',
    'Responda em português. Diferencie fatos de interpretações, explique os conceitos e não invente fontes ou citações. Se precisar de informação que não foi fornecida, indique o que falta. Não afirme ter pesquisado na internet sem uma ferramenta de busca disponível. Em conclusões, não acrescente resultados que não constam no material de apoio.',
  ].filter(Boolean).join('\n\n');
}
