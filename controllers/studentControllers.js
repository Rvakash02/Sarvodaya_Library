const Student = require('../models/studentSchema');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const addStudent = async (req, res) => {
    try {
        const { name, phone, shifts, seatNumber, feePaid } = req.body;

        const shiftsArray = Array.isArray(shifts) ? shifts : [shifts];

        const conflictingStudent = await Student.findOne({
            seatNumber: seatNumber,
            shifts: { $in: shiftsArray }
        });

        if(conflictingStudent){
            return res.status(400).json({ 
                error: `Seat ${seatNumber} is already occupied in one of the selected shifts.` 
            });
        }

        const isPaid = feePaid === 'true' || feePaid === true;
        const admissionDate = new Date();
        let feeExpireDate = new Date(admissionDate);
        if (isPaid) {
            feeExpireDate.setDate(feeExpireDate.getDate() + 30); 
        }

         const newStudent = new Student({
            ...req.body,
            shifts: shiftsArray,
            feePaid: isPaid,
            admissionDate: admissionDate,
            feeExpireDate: feeExpireDate

        });

        await newStudent.save();
        res.status(201).json({ message: "Student registered successfully", student: newStudent });
        
        // Send WhatsApp confirmation if fee is paid
        if (newStudent.feePaid) {
            const expiryStr = newStudent.feeExpireDate ? new Date(newStudent.feeExpireDate).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            }) : 'N/A';
            const shiftsStr = newStudent.shifts.join(', ');
            const message = `Dear ${newStudent.name},\n\nThank you for registering at Sarvodaya Library! Your payment has been received and Seat ${newStudent.seatNumber} (${shiftsStr}) has been allocated.\n\nExpiry Date: ${expiryStr}.`;
            sendWhatsAppMessage(newStudent.phone, message).catch(console.error);
        }
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const { shift, status, search } = req.query;

        // Parse shifts parameter (can be string, array, or comma-separated list)
        let shiftsArray = [];
        if (shift) {
            shiftsArray = Array.isArray(shift) 
                ? shift 
                : shift.split(',').map(s => s.trim()).filter(Boolean);
        }

        // --- LAZY UPDATE LOGIC ---
        // Scans and turns expired memberships to unpaid (feePaid: false) before returning data
        await Student.updateMany(
            { feeExpireDate: { $lt: new Date() }, feePaid: true },
            { $set: { feePaid: false } }
        );

        let students = [];
        let vacantSeats = [];
        if (status === 'vacant') {
            // Find all occupied seats (in selected shifts, or across all shifts if none selected)
            let occupiedQuery = {};
            if (shiftsArray.length > 0) {
                occupiedQuery.shifts = { $in: shiftsArray };
            }
            const occupiedStudents = await Student.find(occupiedQuery);
            const occupiedSeats = occupiedStudents.map(s => s.seatNumber);
            // Calculate remaining available seats (from 43 total)
            for (let i = 1; i <= 43; i++) {
                if (!occupiedSeats.includes(i)) {
                    vacantSeats.push(i);
                }
            }
        } else {
            // Build query filter dynamically
            let query = {};
            if (shiftsArray.length > 0) {
                query.shifts = { $in: shiftsArray };
            }
            if (status === 'paid') {
                query.feePaid = true;
            } else if (status === 'unpaid') {
                query.feePaid = false;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ];
            }
            students = await Student.find(query).sort({ seatNumber: 1 });
        }
        res.json({ students, vacantSeats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const renewFees = async (req, res) => {
    try {
        const { studentId } = req.body;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        // Extend expiry date by 30 days from previous expiry (or from today if already expired)
        let baseDate = student.feeExpireDate && new Date(student.feeExpireDate) > new Date()
            ? new Date(student.feeExpireDate)
            : new Date();
        baseDate.setDate(baseDate.getDate() + 30);

        student.feePaid = true;
        student.feeExpireDate = baseDate;

        await student.save();
        res.json({ message: "Fees renewed successfully", feeExpireDate: student.feeExpireDate });
        
        // Send WhatsApp confirmation on renewal
        const expiryStr = student.feeExpireDate ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) : 'N/A';
        const shiftsStr = student.shifts.join(', ');
        const message = `Dear ${student.name},\n\nThank you! Your fee payment has been received and subscription for Seat ${student.seatNumber} (${shiftsStr}) has been renewed.\n\nExpiry Date: ${expiryStr}.`;
        sendWhatsAppMessage(student.phone, message).catch(console.error);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateStudent = async (req, res) => {
    try {
        const { studentId, name, phone, shifts, seatNumber, feePaid, feeExpireDate } = req.body;
        const shiftsArray = Array.isArray(shifts) ? shifts : [shifts];

        // 1. Conflict validation check: make sure the new seat/shifts don't overlap with another student
        const conflictingStudent = await Student.findOne({
            _id: { $ne: studentId }, // Exclude the student being updated
            seatNumber: seatNumber,
            shifts: { $in: shiftsArray }
        });

        if (conflictingStudent) {
            return res.status(400).json({ 
                error: `Seat ${seatNumber} is already occupied by ${conflictingStudent.name} in one of the selected shifts.` 
            });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Student not found." });
        }

        // 2. Perform updates
        student.name = name;
        student.phone = phone;
        student.shifts = shiftsArray;
        student.seatNumber = seatNumber;
        
        const isPaid = feePaid === 'true' || feePaid === true;
        const wasPaid = student.feePaid;
        student.feePaid = isPaid;

        if (isPaid && !wasPaid) {
            // Toggled from unpaid to paid: extend by 30 days
            let newExpiry = new Date(student.feeExpireDate || Date.now());
            newExpiry.setDate(newExpiry.getDate() + 30);
            student.feeExpireDate = newExpiry;

            // Send WhatsApp confirmation on fee update toggle
            const expiryStr = newExpiry.toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            const shiftsStr = student.shifts.join(', ');
            const message = `Dear ${student.name},\n\nYour library fee payment has been received and Seat ${student.seatNumber} (${shiftsStr}) has been renewed.\n\nExpiry Date: ${expiryStr}. Thank you!`;
            sendWhatsAppMessage(student.phone, message).catch(console.error);
        } else if (feeExpireDate) {
            // Explicitly set custom expiry date if provided
            student.feeExpireDate = new Date(feeExpireDate);
        }

        await student.save();
        res.json({ message: "Student updated successfully", student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const { studentId } = req.body;
        const result = await Student.findByIdAndDelete(studentId);
        if (!result) {
            return res.status(404).json({ error: "Student not found." });
        }
        res.json({ message: "Student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    addStudent,
    getDashboardData,
    renewFees,
    updateStudent,
    deleteStudent
};