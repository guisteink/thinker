const mongoose = require('mongoose');
const { appInfo } = require('../config');

const appointmentSchema = new mongoose.Schema({
    nomeCliente: {
        type: String,
        required: [true, 'O nome do cliente é obrigatório.'],
        trim: true
    },
    numeroContato: {
        type: String,
        required: [true, 'O número de contato é obrigatório.'],
        trim: true,
    },
    servicoAgendado: {
        type: String,
        required: [true, 'O serviço agendado é obrigatório.'],
        trim: true
    },
    data: {
        type: Date, // Armazena a data e hora completas do agendamento
        required: [true, 'A data e hora do agendamento são obrigatórias.']
    },
    nomeAtendente: { 
        type: String,
        required: [true, 'O nome do atendente é obrigatório.'],
        default: appInfo.nomePessoa
    },
    clienteRecorrente: {
        type: Boolean,
        default: false
    },
    // Adicionando timestamps para controle de criação e atualização
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

// Middleware para atualizar 'updatedAt' em operações de update
// Nota: findByIdAndUpdate dispara 'findOneAndUpdate'
appointmentSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Função para buscar agendamentos existentes em um intervalo de tempo
appointmentSchema.statics.findAppointmentsInRange = async function(dayStart, dayEnd) {
    const existingAppointments = await this.find({
        data: {
            $gte: dayStart,
            $lte: dayEnd
        },
        nomeAtendente: appInfo.nomePessoa // Filter by attendant
    }).sort({ data: 1 }).lean();
    return existingAppointments;
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;