const mongoose = require('mongoose')

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique : true
    },
    // Array allowing multiple shift selections (e.g. ['10am-2pm', '2pm-6pm'])
    shifts: [{
        type: String,
        enum: ['6am-10am', '10am-2pm', '2pm-6pm', '6pm-10pm', 'night'],
        required: true
    }],
    // Assigned seat number between 1 and 43
    seatNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 43
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

})

const Student = mongoose.model('Student', studentSchema);
module.exports = Student;