const mongoose = require('mongoose');

const coachingStudentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    batch: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        trim: true,
        default: ''
    },
    monthlyFee: {
        type: Number,
        default: 0
    },
    feePaid: {
        type: Boolean,
        default: false
    },
    admissionDate: {
        type: Date,
        default: Date.now
    },
    feeExpireDate: {
        type: Date,
        required: true
    }
});

const CoachingStudent = mongoose.model('CoachingStudent', coachingStudentSchema);
module.exports = CoachingStudent;
