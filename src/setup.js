const readline = require('readline');
const config = require('./config');
const { log } = require('./utils');

/**
 * Solicita e captura informações do usuário pelo terminal
 */
async function setupConfig() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  try {
    // Solicitar nome da pessoa
    const nome = await question(`Nome da pessoa que aparecerá na msg inicial: `);
    if (nome) config.appInfo.nomePessoa = nome;

    // Solicitar chave PIX
    const chavePix = await question(`Chave PIX para receber: `);
    if (chavePix) config.appInfo.chavePix = chavePix;

    // Solicitar serviços realizados
    console.log('\nServiços realizados atuais:');
    config.appInfo.servicosRealizados.forEach((servico, index) => {
      console.log(`${index + 1}. ${servico}`);
    });
    
    const updateServicos = await question('\nDeseja atualizar os serviços? (s/n): ');
    
    if (updateServicos.toLowerCase() === 's') {
      const novosServicos = await question('Digite os serviços separados por vírgula: ');
      if (novosServicos) {
        config.appInfo.servicosRealizados = novosServicos
          .split(',')
          .map(servico => servico.trim())
          .filter(Boolean);
      }
    }
    
    log('Configuração concluída!', 'info');
    log(`Nome: ${config.appInfo.nomePessoa}`, 'info');
    log(`Chave PIX: ${config.appInfo.chavePix}`, 'info');
    log(`Serviços: ${config.appInfo.servicosRealizados.join(', ')}`, 'info');
    
  } catch (error) {
    log(`Erro na configuração: ${error.message}`, 'error');
  } finally {
    rl.close();
  }
  
  return config;
}

module.exports = setupConfig;