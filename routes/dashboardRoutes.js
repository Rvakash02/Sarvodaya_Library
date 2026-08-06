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
const { getWhatsAppStatus, sendWhatsAppMessage, reconnectWhatsApp } = require('../services/whatsapp');
const Student = require('../models/studentSchema');
const CoachingStudent = require('../models/coachingStudentSchema');

// Protect all endpoints in this router to be accessed ONLY by authenticated admin users
router.use(basicAuth);
router.use(roleAuth('admin'));

// WhatsApp Endpoints
router.get('/whatsapp-status', (req, res) => {
    res.json(getWhatsAppStatus());
});

router.post('/whatsapp-reconnect', async (req, res) => {
    try {
        await reconnectWhatsApp(true);
        res.json({ success: true, message: 'WhatsApp client re-initialization started.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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

        const libraryStudents = await Student.find();
        const coachingStudents = await CoachingStudent.find();

        const libraryTotal = libraryStudents.length;
        const libraryPaid = libraryStudents.filter(s => s.feePaid).length;

        const coachingTotal = coachingStudents.length;
        const coachingPaid = coachingStudents.filter(s => s.feePaid).length;

        // Calculate Revenue Metrics
        let libraryPaidRevenue = 0;
        let libraryPendingRevenue = 0;
        libraryStudents.forEach(s => {
            const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);
            if (s.feePaid) {
                libraryPaidRevenue += fee;
            } else {
                libraryPendingRevenue += fee;
            }
        });

        let coachingPaidRevenue = 0;
        let coachingPendingRevenue = 0;
        coachingStudents.forEach(s => {
            const fee = Number(s.monthlyFee) || 0;
            if (s.feePaid) {
                coachingPaidRevenue += fee;
            } else {
                coachingPendingRevenue += fee;
            }
        });

        const totalRevenueThisMonth = libraryPaidRevenue + coachingPaidRevenue;
        const totalPendingRevenue = libraryPendingRevenue + coachingPendingRevenue;
        const totalProjectedRevenue = totalRevenueThisMonth + totalPendingRevenue;
        const collectionRate = totalProjectedRevenue > 0 ? Math.round((totalRevenueThisMonth / totalProjectedRevenue) * 100) : 0;

        // Generate 6-month historical trend data for monthly growth chart
        const months = [];
        const libraryTrend = [];
        const coachingTrend = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
            months.push(monthLabel);

            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

            let libMonthSum = 0;
            libraryStudents.forEach(s => {
                const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);
                if (adm <= mEnd && s.feePaid) {
                    libMonthSum += fee;
                }
            });

            let coachMonthSum = 0;
            coachingStudents.forEach(s => {
                const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                const fee = Number(s.monthlyFee) || 0;
                if (adm <= mEnd && s.feePaid) {
                    coachMonthSum += fee;
                }
            });

            libraryTrend.push(libMonthSum);
            coachingTrend.push(coachMonthSum);
        }

        res.render('dashboardSelector', {
            stats: {
                libraryTotal,
                libraryPaid,
                libraryUnpaid: libraryTotal - libraryPaid,
                coachingTotal,
                coachingPaid,
                coachingUnpaid: coachingTotal - coachingPaid
            },
            financials: {
                totalRevenueThisMonth,
                totalPendingRevenue,
                totalProjectedRevenue,
                collectionRate,
                libraryPaidRevenue,
                libraryPendingRevenue,
                coachingPaidRevenue,
                coachingPendingRevenue,
                chartData: {
                    months,
                    libraryTrend,
                    coachingTrend
                }
            }
        });
    } catch (err) {
        console.error('Error loading dashboard selector stats:', err);
        res.render('dashboardSelector', {
            stats: { libraryTotal: 0, libraryPaid: 0, libraryUnpaid: 0, coachingTotal: 0, coachingPaid: 0, coachingUnpaid: 0 },
            financials: {
                totalRevenueThisMonth: 0,
                totalPendingRevenue: 0,
                totalProjectedRevenue: 0,
                collectionRate: 0,
                libraryPaidRevenue: 0,
                libraryPendingRevenue: 0,
                coachingPaidRevenue: 0,
                coachingPendingRevenue: 0,
                chartData: { months: [], libraryTrend: [], coachingTrend: [] }
            }
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