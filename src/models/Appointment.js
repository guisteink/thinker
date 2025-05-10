const mongoose = require('mongoose');
const config = require('../config'); // Assuming config is in src/config

// Helper functions for time calculations
function timeStringToMinutes(timeStr) {
  if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return null;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes < 0) {
    return "00:00";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const displayHours = hours % 24;
  return `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const appointmentSchema = new mongoose.Schema({
  tipoDeServico: {
    type: String,
    required: [true, 'O tipo de serviço é obrigatório.'],
    trim: true,
    validate: {
      validator: function(value) {
        return config.appInfo.servicosRealizados && config.appInfo.servicosRealizados.includes(value);
      },
      message: props => {
        const services = config.appInfo.servicosRealizados || [];
        if (services.length === 0) {
          return `${props.value} não é um tipo de serviço válido. Não há serviços configurados.`;
        }
        return `${props.value} não é um tipo de serviço válido. Serviços disponíveis: ${services.join(', ')}.`;
      }
    }
  },
  nomeCliente: {
    type: String,
    required: [true, 'O nome do cliente é obrigatório.'],
    trim: true
  },
  nomeAtendente: {
    type: String,
    trim: true,
    default: () => config.appInfo.nomePessoa
  },
  tempoDeAgendamento: {
    type: Number,
    default: 30,
    min: [5, 'O tempo de agendamento deve ser de no mínimo 5 minutos.']
  },
  horaInicio: {
    type: String,
    required: [true, 'A hora de início é obrigatória.'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Use HH:MM']
  },
  horaFim: {
    type: String,
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora de fim calculado inválido. Use HH:MM']
  },
  valorDoServico: {
    type: Number,
    default: 30,
    min: [0, 'O valor do serviço não pode ser negativo.']
  },
  estaPago: {
    type: Boolean,
    default: false
  },
  dataAgendamento: {
    type: String,
    required: [true, 'A data do agendamento é obrigatória.'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use YYYY-MM-DD']
  },
  clienteRecorrente: {
    type: Boolean,
    default: false
  },
  whatsappClientId: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware para calcular horaFim ANTES de outras validações ou save.
appointmentSchema.pre('save', function(next) {
  if (this.horaInicio && (this.isNew || this.isModified('horaInicio') || this.isModified('tempoDeAgendamento'))) {
    const duracao = this.get('tempoDeAgendamento');
    if (typeof duracao === 'number' && duracao >= 0) {
      const inicioMinutes = timeStringToMinutes(this.horaInicio);
      if (inicioMinutes !== null) {
        const fimMinutes = inicioMinutes + duracao;
        this.horaFim = minutesToTimeString(fimMinutes);
      } else {
        this.horaFim = undefined;
      }
    }
  } else if (!this.horaInicio && this.isModified('horaInicio')) {
    this.horaFim = undefined;
  }
  next();
});

// Middleware para atualizar 'updatedAt' antes de salvar
appointmentSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.updatedAt = new Date();
  }
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;