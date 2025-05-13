const mongoose = require('mongoose');
const config = require('../config');
const { log } = require('../utils/log');
const Appointment = require('../models/Appointment'); 
const moment = require('moment-timezone'); 

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
        // Considerar um mecanismo de retry 
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
      log(`Agendamento criado para ${appointmentData.nomeCliente} em ${moment(appointmentData.data).tz('America/Sao_Paulo').format('YYYY-MM-DD HH:mm')}`, 'info');
      return newAppointment.toObject(); 
    } catch (error) {
      log(`Erro ao criar agendamento: ${error.message} - Data: ${JSON.stringify(appointmentData)}`, 'error');
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
      const appointments = await this.Appointment.find(filter).lean(); 
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
   * Verifica horários disponíveis para uma data específica, atendente e duração de serviço.
   * @param {string} dataAgendamento - Data no formato YYYY-MM-DD.
   * @param {string} nomeAtendente - Nome do atendente (ex: "gui").
   * @param {number} duracaoServicoMinutos - Duração do serviço em minutos.
   * @returns {Promise<Array<string>>} Lista de horários disponíveis (ex: ["08:00", "08:30"]).
   */
  async getAvailableSlots(
    dataAgendamento, // YYYY-MM-DD string
    nomeAtendente,
    duracaoServicoMinutos
  ) {
    try {
      const timezone = 'America/Sao_Paulo'; // Consistent timezone
      const targetDateMoment = moment.tz(dataAgendamento, 'YYYY-MM-DD', timezone);

      if (!targetDateMoment.isValid()) {
        log(`Data de agendamento inválida fornecida para getAvailableSlots: ${dataAgendamento}`, 'error');
        return [];
      }

      // Define working hours for 'gui'
      // Monday to Friday: 08:00-12:00 and 13:00-20:00
      const dayOfWeek = targetDateMoment.day(); // 0 (Sunday) to 6 (Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
        log(`Atendente ${nomeAtendente} não trabalha aos fins de semana. Data: ${dataAgendamento}`, 'info');
        return []; // Gui doesn't work on weekends
      }

      const workingHours = [
        { start: "08:00", end: "12:00" },
        { start: "13:00", end: "20:00" }
      ];

      const dayStartForQuery = targetDateMoment.clone().startOf('day').toDate();
      const dayEndForQuery = targetDateMoment.clone().endOf('day').toDate();

      const existingAppointments = await this.Appointment.find({
        data: {
          $gte: dayStartForQuery,
          $lte: dayEndForQuery
        },
        nomeAtendente: nomeAtendente
      }).sort({ data: 1 }).lean();

      const bookedSlots = existingAppointments.map(app => {
        const start = moment(app.data).tz(timezone);
        // Assuming all appointments (existing and new) are 30 minutes as per requirement
        const end = start.clone().add(duracaoServicoMinutos, 'minutes');
        return { start, end };
      });

      const availableSlots = [];

      for (const period of workingHours) {
        let currentSlotStartMoment = targetDateMoment.clone().set({
          hour: parseInt(period.start.split(':')[0]),
          minute: parseInt(period.start.split(':')[1]),
          second: 0, millisecond: 0
        });

        const periodEndMoment = targetDateMoment.clone().set({
          hour: parseInt(period.end.split(':')[0]),
          minute: parseInt(period.end.split(':')[1]),
          second: 0, millisecond: 0
        });

        while (currentSlotStartMoment.clone().add(duracaoServicoMinutos, 'minutes').isSameOrBefore(periodEndMoment)) {
          const potentialSlotStart = currentSlotStartMoment.clone();
          const potentialSlotEnd = currentSlotStartMoment.clone().add(duracaoServicoMinutos, 'minutes');

          let isSlotFree = true;
          for (const booked of bookedSlots) {
            // Check for overlap:
            // (potentialSlotStart < booked.end) AND (potentialSlotEnd > booked.start)
            if (potentialSlotStart.isBefore(booked.end) && potentialSlotEnd.isAfter(booked.start)) {
              isSlotFree = false;
              break;
            }
          }

          if (isSlotFree) {
            availableSlots.push(potentialSlotStart.format('HH:mm'));
          }
          currentSlotStartMoment.add(30, 'minutes'); // Always 30 min intervals for generating potential slots
        }
      }

      log(`Available slots for ${nomeAtendente} on ${dataAgendamento} (duration ${duracaoServicoMinutos}min, TZ: ${timezone}): ${availableSlots.join(', ')}`, 'info');
      return availableSlots;

    } catch (error) {
      log(`Erro ao buscar horários disponíveis para ${nomeAtendente} em ${dataAgendamento}: ${error.message} ${error.stack}`, 'error');
      // throw error; // Decide if you want to throw or return empty on error
      return []; // Return empty on error to prevent flow breakage, error is logged
    }
  }

  _timeStringToMinutes(timeStr) { 
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  _minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

const mongoInstance = new MongoService();
module.exports = mongoInstance;