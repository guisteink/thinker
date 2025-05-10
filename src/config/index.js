module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  whatsapp: {
    clientOptions: {}
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-c846ab0abb1e4959b888bcfd2ff2e760',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    maxTokens: 1000,
    temperature: 0.7
  },
  appInfo: {
    nomePessoa: process.env.NOME_PESSOA || '', 
    servicosRealizados: process.env.SERVICOS_REALIZADOS ? 
      process.env.SERVICOS_REALIZADOS.split(',') : 
      [],
    chavePix: process.env.CHAVE_PIX || ''
  },
  menuConfig: {
    // Configuração do cabeçalho e introdução da mensagem
    header: process.env.MENU_HEADER || 'Ola, aqui é o {nomePessoa} e estou em horário de trabalho',
    
    // Configuração das opções do menu
    optionPrefix: process.env.MENU_PREFIX || 'Digite o que deseja:',
    options: {
      '1': process.env.MENU_OPTION_1 || 'Ver horarios disponiveis na agenda da semana',
      '2': process.env.MENU_OPTION_2 || 'Agendar horario',
      '3': process.env.MENU_OPTION_3 || 'Cancelar horario',
      '4': process.env.MENU_OPTION_4 || 'Alterar horario',
      '5': process.env.MENU_OPTION_6 || 'Consultar serviços'
    },

    footer: process.env.MENU_FOOTER || 'Se deseja apenas consultar a chave pix: {chavePix}'
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/thinker_db', // Altere 'thinker_db' para o nome do seu banco
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Outras opções do Mongoose podem ser adicionadas aqui
    }
  },
  delays: {
    typing: 1500
  }
};