const express = require('express');
const router = express.Router();
const { addStudent, getDashboardData, renewFees, updateStudent, deleteStudent } = require('../controllers/studentControllers');
const { 
    addCoachingStudent, 
    getCoachingDashboardData, 
    renewCoachingFees, 
    updateCoachingStudent, 
    deleteCoachingStudent 
} = require('../controllers/coachingControllers');
const { basicAuth, roleAuth } = require('../middleware/auth');
const { getWhatsAppStatus, sendWhatsAppMessage } = require('../services/whatsapp');
const Student = require('../models/studentSchema');
const CoachingStudent = require('../models/coachingStudentSchema');

// Protect all endpoints in this router to be accessed ONLY by authenticated admin users
router.use(basicAuth);
router.use(roleAuth('admin'));

// WhatsApp Endpoints
router.get('/whatsapp-status', (req, res) => {
    res.json(getWhatsAppStatus());
});

router.post('/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;
    if (!phone || !message) {
        return res.status(400).json({ error: 'Phone number and message are required.' });
    }
    try {
        const sent = await sendWhatsAppMessage(phone, message);
        if (sent) {
            res.json({ success: true, message: 'Message sent successfully.' });
        } else {
            res.status(503).json({ error: 'WhatsApp client is not connected. Please scan the QR code first.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Main Choice Portal
router.get('/dashboard', async (req, res) => {
    try {
        // Perform lazy update for both systems
        await Student.updateMany({ feeExpireDate: { $lt: new Date() }, feePaid: true }, { $set: { feePaid: false } });
        await CoachingStudent.updateMany({ feeExpireDate: { $lt: new Date() }, feePaid: true }, { $set: { feePaid: false } });

        const libraryTotal = await Student.countDocuments();
        const libraryPaid = await Student.countDocuments({ feePaid: true });
        const coachingTotal = await CoachingStudent.countDocuments();
        const coachingPaid = await CoachingStudent.countDocuments({ feePaid: true });

        res.render('dashboardSelector', {
            stats: {
                libraryTotal,
                libraryPaid,
                libraryUnpaid: libraryTotal - libraryPaid,
                coachingTotal,
                coachingPaid,
                coachingUnpaid: coachingTotal - coachingPaid
            }
        });
    } catch (err) {
        res.render('dashboardSelector', {
            stats: { libraryTotal: 0, libraryPaid: 0, libraryUnpaid: 0, coachingTotal: 0, coachingPaid: 0, coachingUnpaid: 0 }
        });
    }
});

// Library Dashboard View
router.get('/dashboard/library', (req, res) => {
    res.render('dashboard');
});

// Coaching Dashboard View
router.get('/dashboard/coaching', (req, res) => {
    res.render('coachingDashboard');
});

// --- LIBRARY STUDENT MANAGEMENT ROUTES ---
router.get('/register', (req, res) => {
    res.render('addStudent');
});
router.post('/register', addStudent);
router.get('/dashboard-data', getDashboardData);
router.post('/renew-fee', renewFees);
router.post('/update-student', updateStudent);
router.post('/delete-student', deleteStudent);

// --- COACHING STUDENT MANAGEMENT ROUTES ---
router.get('/coaching/register', (req, res) => {
    res.render('addCoachingStudent');
});
router.post('/coaching/register', addCoachingStudent);
router.get('/coaching/dashboard-data', getCoachingDashboardData);
router.post('/coaching/renew-fee', renewCoachingFees);
router.post('/coaching/update-student', updateCoachingStudent);
router.post('/coaching/delete-student', deleteCoachingStudent);

module.exports = router;