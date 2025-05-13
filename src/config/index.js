const dotenv = require('dotenv');
dotenv.config();   // carrega .env na raiz

function normalize(s) {
  return s.trim().toLowerCase();
}

module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  whatsapp: {
    clientOptions: {}
  },
  appInfo: {
    nomePessoa:         process.env.NOME_PESSOA,
    servicosRealizados: process.env.SERVICOS_REALIZADOS
                           ? process.env.SERVICOS_REALIZADOS.split(',').map(normalize)
                           : []
  },
  workSchedule: {
    horaInicio:   process.env.HORA_INICIO,
    horaFim:      process.env.HORA_FIM,
    inicioAlmoco: process.env.INICIO_ALMOCO,
    fimAlmoco:    process.env.FIM_ALMOCO
  },
  mongodb: {
    uri:     process.env.MONGODB_URI,
    options: {}
  },
  delays: {
    typing: Number(process.env.DELAY_TYPING) || 1500
  }
};