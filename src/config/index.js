
module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  whatsapp: {
    clientOptions: {}
  },
  appInfo: {
    nomePessoa: process.env.NOME_PESSOA || '', 
    servicosRealizados: process.env.SERVICOS_REALIZADOS ? 
      process.env.SERVICOS_REALIZADOS.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(normalizeServiceNameForConfig) // Normalize services from .env
      : [],
    chavePix: process.env.CHAVE_PIX || ''
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://admin:admin@cluster0.j4mupkt.mongodb.net/',
    options: {}
  },
  delays: {
    typing: 1500 
  }
};