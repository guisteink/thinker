const readline = require('readline');
const config = require('./config');
const { log, delay } = require('./utils');

// Function to normalize service names
function normalizeServiceName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

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
    await delay(500); 

    const nome = await question(`\nNome da pessoa que aparecerá na msg inicial: `);
    if (nome) config.appInfo.nomePessoa = nome;

    const chavePix = await question(`Chave PIX para receber: `);
    if (chavePix) config.appInfo.chavePix = chavePix;

    console.log('\nServiços realizados atuais (normalizados):');
    if (config.appInfo.servicosRealizados && config.appInfo.servicosRealizados.length > 0) {
      config.appInfo.servicosRealizados.forEach((servico, index) => {
        // Assuming servicosRealizados stores the normalized names
        console.log(`${index + 1}. ${servico}`); 
      });
    } else {
      console.log('(Nenhum serviço configurado)');
    }
    
    let updateServicosChoice = await question('\nDeseja atualizar/definir os serviços? (s/n): ');
    
    // If no services are configured, force the user to add at least one.
    if (config.appInfo.servicosRealizados.length === 0 && updateServicosChoice.toLowerCase() !== 's') {
        log('É necessário configurar pelo menos um serviço para iniciar.', 'warn');
        updateServicosChoice = 's'; // Force update
    }

    if (updateServicosChoice.toLowerCase() === 's') {
      let novosServicosInput = '';
      let parsedServices = [];
      while (parsedServices.length === 0) {
        novosServicosInput = await question('Digite os serviços separados por vírgula (ex: Corte de Cabelo, Barba). Pelo menos um serviço é obrigatório: ');
        if (novosServicosInput && novosServicosInput.trim() !== '') {
          parsedServices = novosServicosInput
            .split(',')
            .map(servico => servico.trim())
            .filter(Boolean)
            .map(normalizeServiceName); // Normalize here
        }
        if (parsedServices.length === 0) {
          log('Nenhum serviço válido fornecido. Por favor, insira pelo menos um serviço.', 'warn');
        }
      }
      config.appInfo.servicosRealizados = parsedServices;
    }
    
    log('Configuração concluída!', 'info');
    log(`Nome: ${config.appInfo.nomePessoa}`, 'info');
    log(`Chave PIX: ${config.appInfo.chavePix}`, 'info');
    // Display normalized services
    log(`Serviços (normalizados): ${config.appInfo.servicosRealizados.join(', ') || 'Nenhum'}`, 'info'); 
    
  } catch (error) {
    log(`Erro na configuração: ${error.message}`, 'error');
    process.exit(1); // Exit if setup fails critically
  } finally {
    rl.close();
  }
  
  return config;
}

module.exports = setupConfig;