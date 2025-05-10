const mongoose = require('mongoose');
const config = require('../config');
const { log } = require('../utils');
const Appointment = require('../models/Appointment'); // Importa o modelo

class MongoService {
  constructor() {
    this.Appointment = Appointment;
    this._connect();
  }

  _connect() {
    mongoose.connect(config.mongodb.uri, config.mongodb.options)
      .then(() => {
        log('MongoDB conectado com sucesso!', 'info');
      })
      .catch(err => {
        log(`Erro ao conectar ao MongoDB: ${err.message}`, 'error');
        // Considere um mecanismo de retry ou encerrar a aplicação se a conexão for crítica
        process.exit(1);
      });

    mongoose.connection.on('error', err => {
      log(`Erro na conexão MongoDB: ${err.message}`, 'error');
    });

    mongoose.connection.on('disconnected', () => {
      log('MongoDB desconectado.', 'warn');
    });
  }

  /**
   * Cria um novo agendamento.
   * @param {Object} appointmentData - Dados do agendamento.
   * @returns {Promise<Object>} O agendamento criado.
   */
  async createAppointment(appointmentData) {
    try {
      const newAppointment = new this.Appointment(appointmentData);
      await newAppointment.save();
      log(`Agendamento criado para ${appointmentData.nomeCliente} em ${appointmentData.dataAgendamento}`, 'info');
      return newAppointment.toObject(); // Retorna um objeto simples
    } catch (error) {
      log(`Erro ao criar agendamento: ${error.message}`, 'error');
      throw error; // Re-throw para ser tratado pelo chamador
    }
  }

  /**
   * Busca agendamentos com base em um filtro.
   * @param {Object} filter - Critérios de busca (ex: { dataAgendamento: '2025-05-10' }).
   * @returns {Promise<Array<Object>>} Uma lista de agendamentos.
   */
  async findAppointments(filter = {}) {
    try {
      const appointments = await this.Appointment.find(filter).lean(); // .lean() para objetos simples
      log(`Busca de agendamentos com filtro ${JSON.stringify(filter)} retornou ${appointments.length} resultados.`, 'info');
      return appointments;
    } catch (error) {
      log(`Erro ao buscar agendamentos: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Busca um agendamento pelo ID.
   * @param {string} id - O ID do agendamento.
   * @returns {Promise<Object|null>} O agendamento encontrado ou null.
   */
  async findAppointmentById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        log(`ID de agendamento inválido fornecido: ${id}`, 'warn');
        return null;
      }
      const appointment = await this.Appointment.findById(id).lean();
      if (appointment) {
        log(`Agendamento encontrado pelo ID ${id}.`, 'info');
      } else {
        log(`Nenhum agendamento encontrado com ID ${id}.`, 'info');
      }
      return appointment;
    } catch (error) {
      log(`Erro ao buscar agendamento por ID ${id}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Atualiza um agendamento.
   * @param {string} id - O ID do agendamento a ser atualizado.
   * @param {Object} updateData - Os dados para atualizar.
   * @returns {Promise<Object|null>} O agendamento atualizado ou null se não encontrado.
   */
  async updateAppointment(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        log(`ID de agendamento inválido para atualização: ${id}`, 'warn');
        return null;
      }
      // { new: true } retorna o documento modificado
      // { runValidators: true } garante que as validações do schema sejam aplicadas na atualização
      const updatedAppointment = await this.Appointment.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean();
      if (updatedAppointment) {
        log(`Agendamento ${id} atualizado.`, 'info');
      } else {
        log(`Agendamento ${id} não encontrado para atualização.`, 'info');
      }
      return updatedAppointment;
    } catch (error) {
      log(`Erro ao atualizar agendamento ${id}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Deleta um agendamento.
   * @param {string} id - O ID do agendamento a ser deletado.
   * @returns {Promise<Object|null>} O agendamento deletado ou null se não encontrado.
   */
  async deleteAppointment(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        log(`ID de agendamento inválido para deleção: ${id}`, 'warn');
        return null;
      }
      const deletedAppointment = await this.Appointment.findByIdAndDelete(id).lean();
      if (deletedAppointment) {
        log(`Agendamento ${id} deletado.`, 'info');
      } else {
        log(`Agendamento ${id} não encontrado para deleção.`, 'info');
      }
      return deletedAppointment;
    } catch (error) {
      log(`Erro ao deletar agendamento ${id}: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Verifica horários disponíveis para uma data e atendente específicos.
   * @param {string} dataAgendamento - Data no formato YYYY-MM-DD.
   * @param {string} nomeAtendente - Nome do atendente.
   * @param {number} duracaoServico - Duração do serviço em minutos.
   * @param {string} horarioFuncionamentoInicio - Ex: "09:00"
   * @param {string} horarioFuncionamentoFim - Ex: "18:00"
   * @param {number} intervaloMinimo - Intervalo mínimo entre agendamentos em minutos (ex: 15).
   * @returns {Promise<Array<string>>} Lista de horários disponíveis (ex: ["09:00", "10:30"]).
   */
  async getAvailableSlots(dataAgendamento, nomeAtendente, duracaoServico, horarioFuncionamentoInicio = "09:00", horarioFuncionamentoFim = "18:00", intervaloMinimo = 15) {
    try {
      const existingAppointments = await this.findAppointments({
        dataAgendamento,
        nomeAtendente
      });

      const slots = [];
      let currentTime = this._timeStringToMinutes(horarioFuncionamentoInicio);
      const endTime = this._timeStringToMinutes(horarioFuncionamentoFim);

      while (currentTime + duracaoServico <= endTime) {
        const slotStart = currentTime;
        const slotEnd = currentTime + duracaoServico;
        let isAvailable = true;

        for (const app of existingAppointments) {
          const appStart = this._timeStringToMinutes(app.horaInicio);
          const appEnd = this._timeStringToMinutes(app.horaFim);

          // Verifica sobreposição
          if (Math.max(slotStart, appStart) < Math.min(slotEnd, appEnd)) {
            isAvailable = false;
            break;
          }
        }

        if (isAvailable) {
          slots.push(this._minutesToTimeString(slotStart));
        }
        currentTime += intervaloMinimo; // Avança para o próximo slot possível
      }
      log(`Horários disponíveis para ${dataAgendamento} com ${nomeAtendente}: ${slots.join(', ')}`, 'info');
      return slots;
    } catch (error) {
      log(`Erro ao buscar horários disponíveis: ${error.message}`, 'error');
      throw error;
    }
  }

  _timeStringToMinutes(timeStr) { // "HH:MM"
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  _minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

// Exporta uma instância singleton do serviço
module.exports = new MongoService();