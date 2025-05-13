const mongoose = require('mongoose');

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
    hora: {
        type: String, 
        required: [true, 'A hora do agendamento é obrigatória.'],
    },
    data: {
        type: Date, // Armazena como data completa, mas pode ser usada para filtrar por dia
        required: [true, 'A data do agendamento é obrigatória.']
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


const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;