const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  tipoDeServico: {
    type: String,
    required: [true, 'O tipo de serviço é obrigatório.'],
    trim: true
  },
  nomeCliente: {
    type: String,
    required: [true, 'O nome do cliente é obrigatório.'],
    trim: true
  },
  nomeAtendente: {
    type: String,
    required: [true, 'O nome do atendente é obrigatório.'],
    trim: true
  },
  tempoDeAgendamento: { // Em minutos, por exemplo
    type: Number,
    required: [true, 'O tempo de agendamento é obrigatório.'],
    min: [5, 'O tempo de agendamento deve ser de no mínimo 5 minutos.']
  },
  horaInicio: { // Formato HH:MM
    type: String,
    required: [true, 'A hora de início é obrigatória.'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Use HH:MM']
  },
  horaFim: { // Formato HH:MM
    type: String,
    required: [true, 'A hora de fim é obrigatória.'],
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Formato de hora inválido. Use HH:MM']
  },
  valorDoServico: {
    type: Number,
    required: [true, 'O valor do serviço é obrigatório.'],
    min: [0, 'O valor do serviço não pode ser negativo.']
  },
  estaPago: {
    type: Boolean,
    default: false
  },
  dataAgendamento: { // Formato YYYY-MM-DD
    type: String, // Ou Date, se preferir manipular como objeto Date
    required: [true, 'A data do agendamento é obrigatória.'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido. Use YYYY-MM-DD']
  },
  clienteRecorrente: {
    type: Boolean,
    default: false
  },
  whatsappClientId: { // Para associar ao cliente no WhatsApp
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

// Middleware para atualizar 'updatedAt' antes de salvar
appointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validação para garantir que horaFim seja depois de horaInicio
appointmentSchema.pre('save', function(next) {
  if (this.horaInicio && this.horaFim) {
    const [startHour, startMinute] = this.horaInicio.split(':').map(Number);
    const [endHour, endMinute] = this.horaFim.split(':').map(Number);
    if (endHour < startHour || (endHour === startHour && endMinute <= startMinute)) {
      return next(new Error('A hora de fim deve ser posterior à hora de início.'));
    }
  }
  next();
});


const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;