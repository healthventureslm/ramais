import type { ChaveTexto, TextoI18n } from '@ramais/contracts';

/** Textos fixos em PT, ES e EN. Variáveis entre chaves: {setor}, {posicao}, {minutos}. */
export const textosHotel: Record<ChaveTexto, TextoI18n> = {
  boas_vindas: {
    pt: 'Olá! Aqui é o atendimento do hotel. Escreva o que você precisa, do jeito que preferir, que a gente encaminha.',
    es: '¡Hola! Este es el servicio del hotel. Escriba lo que necesita, como prefiera, y lo derivamos.',
    en: 'Hi! This is the hotel service desk. Tell us what you need, in your own words, and we will take care of it.',
  },
  pedir_detalhe: {
    pt: 'Claro! Como podemos ajudar? Conte um pouco do que você precisa.',
    es: '¡Claro! ¿Cómo podemos ayudarle? Cuéntenos un poco lo que necesita.',
    en: 'Of course! How can we help? Tell us a bit about what you need.',
  },
  pedir_identificacao: {
    pt: 'Para isso, preciso confirmar sua estadia: qual o número do quarto e o seu sobrenome?',
    es: 'Para eso necesito confirmar su estadía: ¿cuál es el número de habitación y su apellido?',
    en: 'To do that I need to confirm your stay: what is your room number and last name?',
  },
  identificacao_ok: {
    pt: 'Obrigado, estadia confirmada.',
    es: 'Gracias, estadía confirmada.',
    en: 'Thank you, your stay is confirmed.',
  },
  identificacao_pendente: {
    pt: 'Não consegui confirmar automaticamente. A recepção vai conferir em instantes.',
    es: 'No pude confirmarlo automáticamente. La recepción lo verificará en instantes.',
    en: 'I could not confirm that automatically. The front desk will check it shortly.',
  },
  encaminhado: {
    pt: 'Pronto! Seu pedido foi encaminhado para {setor}. Já te respondemos por aqui.',
    es: '¡Listo! Su pedido fue enviado a {setor}. Le respondemos por aquí.',
    en: 'Done! Your request was sent to {setor}. We will reply here.',
  },
  encaminhado_baixa_certeza: {
    pt: 'Recebemos seu pedido e já estamos encaminhando para a pessoa certa.',
    es: 'Recibimos su pedido y lo estamos enviando a la persona indicada.',
    en: 'We got your request and are passing it to the right person.',
  },
  posicao_fila: {
    pt: 'Desculpe a demora. Seu pedido é o {posicao}º da fila e aumentamos a prioridade dele.',
    es: 'Disculpe la demora. Su pedido es el {posicao}º en la fila y aumentamos su prioridad.',
    en: 'Sorry for the wait. Your request is number {posicao} in line and we have raised its priority.',
  },
  emergencia: {
    pt: 'Entendido, é uma emergência. Estamos acionando a equipe agora. Se houver risco à vida, ligue 192 (SAMU) ou 193 (Bombeiros).',
    es: 'Entendido, es una emergencia. Estamos avisando al equipo ahora. Si hay riesgo de vida, llame al 192 (SAMU) o 193 (Bomberos).',
    en: 'Understood, this is an emergency. We are alerting the team now. If there is a risk to life, call 192 (ambulance) or 193 (fire department).',
  },
  humano: {
    pt: 'Certo, vou te passar para uma pessoa da equipe.',
    es: 'De acuerdo, le paso con una persona del equipo.',
    en: 'Sure, I am passing you to a team member.',
  },
  aviso_inatividade: {
    pt: 'Ainda precisa de algo? Se não houver resposta, vamos encerrar este atendimento em {minutos} minutos.',
    es: '¿Necesita algo más? Si no hay respuesta, cerraremos esta atención en {minutos} minutos.',
    en: 'Do you still need anything? If we do not hear back, we will close this request in {minutos} minutes.',
  },
  encerramento: {
    pt: 'Encerramos este atendimento. Quando precisar, é só escrever aqui.',
    es: 'Cerramos esta atención. Cuando necesite algo, escriba aquí.',
    en: 'We have closed this request. Whenever you need something, just write here.',
  },
  encerrado_pelo_solicitante: {
    pt: 'Tudo bem, encerramos por aqui. Qualquer coisa, é só chamar.',
    es: 'Está bien, cerramos aquí. Cualquier cosa, escríbanos.',
    en: 'All right, we are closing this. Anything else, just message us.',
  },
  resolvido: {
    pt: 'Seu pedido foi concluído. Se precisar de mais alguma coisa, é só responder.',
    es: 'Su pedido fue completado. Si necesita algo más, solo responda.',
    en: 'Your request has been completed. If you need anything else, just reply.',
  },
  espera_longa: {
    pt: 'Seu pedido está demorando mais que o normal. Um responsável já foi avisado e vai cuidar disso.',
    es: 'Su pedido está tardando más de lo normal. Un responsable ya fue avisado y se ocupará.',
    en: 'Your request is taking longer than usual. A supervisor has been notified and will take care of it.',
  },
  nao_entendi_midia: {
    pt: 'Recebemos seu arquivo. Pode descrever em uma frase o que precisa?',
    es: 'Recibimos su archivo. ¿Puede describir en una frase lo que necesita?',
    en: 'We received your file. Could you describe in one sentence what you need?',
  },
};
