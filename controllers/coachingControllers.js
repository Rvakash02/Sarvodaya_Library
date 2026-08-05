const CoachingStudent = require('../models/coachingStudentSchema');
const { sendWhatsAppMessage } = require('../services/whatsapp');

const addCoachingStudent = async (req, res) => {
    try {
        const { name, phone, batch, subject, monthlyFee, feePaid } = req.body;

        // Check if student with same phone number already exists
        const existingStudent = await CoachingStudent.findOne({ phone: phone.trim() });
        if (existingStudent) {
            return res.status(400).json({ 
                error: `Coaching student with phone number ${phone} is already registered.` 
            });
        }

        const isPaid = feePaid === 'true' || feePaid === true;
        const admissionDate = new Date();
        let feeExpireDate = new Date(admissionDate);
        if (isPaid) {
            feeExpireDate.setDate(feeExpireDate.getDate() + 30);
        }

        const newStudent = new CoachingStudent({
            name: name.trim(),
            phone: phone.trim(),
            batch: batch ? batch.trim() : 'General',
            subject: subject ? subject.trim() : '',
            monthlyFee: monthlyFee ? Number(monthlyFee) : 0,
            feePaid: isPaid,
            admissionDate: admissionDate,
            feeExpireDate: feeExpireDate
        });

        await newStudent.save();
        res.status(201).json({ message: "Coaching student registered successfully", student: newStudent });

        // Send WhatsApp confirmation if fee is paid
        if (newStudent.feePaid) {
            const expiryStr = newStudent.feeExpireDate ? new Date(newStudent.feeExpireDate).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            }) : 'N/A';
            const message = `Dear ${newStudent.name},\n\nThank you for enrolling in Sarvodaya Coaching Classes! Your fee payment has been received for Batch: ${newStudent.batch}${newStudent.subject ? ' (' + newStudent.subject + ')' : ''}.\n\nExpiry Date: ${expiryStr}.`;
            sendWhatsAppMessage(newStudent.phone, message).catch(console.error);
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCoachingDashboardData = async (req, res) => {
    try {
        const { batch, status, search } = req.query;

        // --- LAZY UPDATE LOGIC ---
        // Scans and turns expired memberships to unpaid (feePaid: false) before returning data
        await CoachingStudent.updateMany(
            { feeExpireDate: { $lt: new Date() }, feePaid: true },
            { $set: { feePaid: false } }
        );

        let query = {};
        if (batch) {
            query.batch = { $regex: batch.trim(), $options: 'i' };
        }
        if (status === 'paid') {
            query.feePaid = true;
        } else if (status === 'unpaid') {
            query.feePaid = false;
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { batch: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await CoachingStudent.find(query).sort({ name: 1 });
        res.json({ students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const renewCoachingFees = async (req, res) => {
    try {
        const { studentId } = req.body;

        const student = await CoachingStudent.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Coaching student not found." });
        }

        // Extend expiry date by 30 days from previous expiry or now
        let baseDate = student.feeExpireDate && new Date(student.feeExpireDate) > new Date()
            ? new Date(student.feeExpireDate)
            : new Date();
        baseDate.setDate(baseDate.getDate() + 30);

        student.feePaid = true;
        student.feeExpireDate = baseDate;

        await student.save();
        res.json({ message: "Coaching fees renewed successfully", feeExpireDate: student.feeExpireDate });

        // Send WhatsApp confirmation on renewal
        const expiryStr = student.feeExpireDate ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) : 'N/A';
        const message = `Dear ${student.name},\n\nThank you! Your coaching fee payment has been received for Batch: ${student.batch}.\n\nNext Fee Expiry Date: ${expiryStr}.`;
        sendWhatsAppMessage(student.phone, message).catch(console.error);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCoachingStudent = async (req, res) => {
    try {
        const { studentId, name, phone, batch, subject, monthlyFee, feePaid, feeExpireDate } = req.body;

        // Check if phone belongs to another student
        if (phone) {
            const conflicting = await CoachingStudent.findOne({
                _id: { $ne: studentId },
                phone: phone.trim()
            });
            if (conflicting) {
                return res.status(400).json({
                    error: `Phone number ${phone} is already used by ${conflicting.name}.`
                });
            }
        }

        const student = await CoachingStudent.findById(studentId);
        if (!student) {
            return res.status(404).json({ error: "Coaching student not found." });
        }

        student.name = name ? name.trim() : student.name;
        student.phone = phone ? phone.trim() : student.phone;
        student.batch = batch ? batch.trim() : student.batch;
        student.subject = subject !== undefined ? subject.trim() : student.subject;
        if (monthlyFee !== undefined) {
            student.monthlyFee = Number(monthlyFee);
        }

        const isPaid = feePaid === 'true' || feePaid === true;
        const wasPaid = student.feePaid;
        student.feePaid = isPaid;

        if (isPaid && !wasPaid) {
            // Toggled from unpaid to paid: extend by 30 days
            let newExpiry = new Date(student.feeExpireDate || Date.now());
            if (newExpiry < new Date()) {
                newExpiry = new Date();
            }
            newExpiry.setDate(newExpiry.getDate() + 30);
            student.feeExpireDate = newExpiry;

            // Send WhatsApp notification
            const expiryStr = newExpiry.toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
            const message = `Dear ${student.name},\n\nYour coaching fee payment has been received for Batch: ${student.batch}.\n\nFee Expiry Date: ${expiryStr}. Thank you!`;
            sendWhatsAppMessage(student.phone, message).catch(console.error);
        } else if (feeExpireDate) {
            student.feeExpireDate = new Date(feeExpireDate);
        }

        await student.save();
        res.json({ message: "Coaching student updated successfully", student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCoachingStudent = async (req, res) => {
    try {
        const { studentId } = req.body;
        const result = await CoachingStudent.findByIdAndDelete(studentId);
        if (!result) {
            return res.status(404).json({ error: "Coaching student not found." });
        }
        res.json({ message: "Coaching student deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    addCoachingStudent,
    getCoachingDashboardData,
    renewCoachingFees,
    updateCoachingStudent,
    deleteCoachingStudent
};
