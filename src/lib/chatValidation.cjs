function validateInput(body) {
  const { messages, systemPrompt = '', skipRAG = false, maxTokens = 2048 } = body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    throw new Error('messages debe contener entre 1 y 30 mensajes.');
  }
  let totalLength = 0;
  const cleanMessages = messages.map(message => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      throw new Error('Cada mensaje debe tener un role y content válidos.');
    }
    if (!message.content.trim() || message.content.length > 12000) {
      throw new Error('Cada mensaje debe contener entre 1 y 12000 caracteres.');
    }
    totalLength += message.content.length;
    return { role: message.role, content: message.content };
  });
  if (totalLength > 50000) throw new Error('El historial excede el límite permitido.');
  if (typeof systemPrompt !== 'string' || systemPrompt.length > 12000) {
    throw new Error('El contexto del asistente excede el límite permitido.');
  }
  const parsedMaxTokens = Number(maxTokens);
  return {
    messages: cleanMessages,
    systemPrompt,
    skipRAG: skipRAG === true,
    maxTokens: Number.isFinite(parsedMaxTokens)
      ? Math.max(256, Math.min(4096, Math.floor(parsedMaxTokens)))
      : 2048,
  };
}

module.exports = { validateInput };
