// Helper function (can be defined here or imported if used in many places)
const normalizeServiceNameForConfig = (name) => {
  if (typeof name !== 'string') return '';
  return name.toLowerCase().replace(/\s+/g, '-');
};

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
      process.env.SERVICOS_REALIZADOS.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(normalizeServiceNameForConfig) // Normalize services from .env
      : [],
    chavePix: process.env.CHAVE_PIX || ''
  },
  menuConfig: {
    header: process.env.MENU_HEADER || 'Oi, aqui é o(a) {nomePessoa} e estou em horário de trabalho',
    optionPrefix: process.env.MENU_PREFIX || 'Digite o que deseja para agilizarmos:',
    options: {
      '1': process.env.MENU_OPTION_1 || 'Agendar horario',
      '2': process.env.MENU_OPTION_2 || 'Cancelar horario',
      '3': process.env.MENU_OPTION_3 || 'Alterar horario',
      '4': process.env.MENU_OPTION_4 || 'Ver serviços oferecidos'
    },
    // The {servicosRealizados} in the footer will display the normalized names.
    // If you want to display user-friendly names, you'd need to store both original and normalized,
    // or have a mapping. For simplicity, we'll display normalized names here.
    footer: process.env.MENU_FOOTER || 'Estou realizando os seguintes servicos: {servicosRealizados}\nChave pix: {chavePix}'
  }, 
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb+srv://admin:admin@cluster0.j4mupkt.mongodb.net/',
    options: {}
  },
  delays: {
    typing: 1500 
  }
};