const { validateInput } = require('./chatValidation.cjs');

describe('validateInput', () => {
  test('acepta y normaliza una conversación válida', () => {
    expect(validateInput({
      messages: [{ role: 'user', content: 'Prepará un encuentro' }],
      maxTokens: 1200.8,
      skipRAG: true,
    })).toMatchObject({ maxTokens: 1200, skipRAG: true });
  });

  test('rechaza roles no permitidos', () => {
    expect(() => validateInput({ messages: [{ role: 'system', content: 'hola' }] }))
      .toThrow(/role/);
  });

  test('rechaza mensajes demasiado largos', () => {
    expect(() => validateInput({ messages: [{ role: 'user', content: 'x'.repeat(12001) }] }))
      .toThrow(/12000/);
  });

  test('limita maxTokens en el servidor', () => {
    expect(validateInput({
      messages: [{ role: 'user', content: 'hola' }],
      maxTokens: 999999,
    }).maxTokens).toBe(4096);
  });
});
