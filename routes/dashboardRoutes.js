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

// Separate Financial Analytics API for Library or Coaching
router.get('/analytics-data', async (req, res) => {
    try {
        const { type } = req.query; // 'library' or 'coaching'

        if (type === 'coaching') {
            const coachingStudents = await CoachingStudent.find();

            let totalPaid = 0;
            let totalPending = 0;
            let paidCount = 0;
            let unpaidCount = 0;

            const batchMap = {};

            coachingStudents.forEach(s => {
                const fee = Number(s.monthlyFee) || 0;
                const batchName = s.batch || 'General';

                if (!batchMap[batchName]) {
                    batchMap[batchName] = { total: 0, paidCount: 0, unpaidCount: 0, paidRev: 0, pendingRev: 0 };
                }

                batchMap[batchName].total++;

                if (s.feePaid) {
                    totalPaid += fee;
                    paidCount++;
                    batchMap[batchName].paidCount++;
                    batchMap[batchName].paidRev += fee;
                } else {
                    totalPending += fee;
                    unpaidCount++;
                    batchMap[batchName].unpaidCount++;
                    batchMap[batchName].pendingRev += fee;
                }
            });

            const totalProjected = totalPaid + totalPending;
            const collectionRate = totalProjected > 0 ? Math.round((totalPaid / totalProjected) * 100) : 0;

            const months = [];
            const trend = [];
            const now = new Date();

            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                months.push(d.toLocaleDateString('en-IN', { month: 'short' }));

                const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                let sum = 0;
                coachingStudents.forEach(s => {
                    const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                    if (adm <= mEnd && s.feePaid) {
                        sum += Number(s.monthlyFee) || 0;
                    }
                });
                trend.push(sum);
            }

            return res.json({
                system: 'Coaching',
                totalStudents: coachingStudents.length,
                paidCount,
                unpaidCount,
                totalPaid,
                totalPending,
                totalProjected,
                collectionRate,
                batchBreakdown: batchMap,
                months,
                trend
            });
        }

        // Default: Library
        const libraryStudents = await Student.find();

        let totalPaid = 0;
        let totalPending = 0;
        let paidCount = 0;
        let unpaidCount = 0;

        const shiftList = ['6am-10am', '10am-2pm', '2pm-6pm', '6pm-10pm', 'night'];
        const shiftMap = {};
        shiftList.forEach(st => {
            shiftMap[st] = { total: 0, paidCount: 0, unpaidCount: 0, paidRev: 0, pendingRev: 0 };
        });

        libraryStudents.forEach(s => {
            const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);

            if (s.feePaid) {
                totalPaid += fee;
                paidCount++;
            } else {
                totalPending += fee;
                unpaidCount++;
            }

            if (s.shifts && Array.isArray(s.shifts)) {
                s.shifts.forEach(sh => {
                    if (shiftMap[sh]) {
                        shiftMap[sh].total++;
                        if (s.feePaid) {
                            shiftMap[sh].paidCount++;
                            shiftMap[sh].paidRev += 500;
                        } else {
                            shiftMap[sh].unpaidCount++;
                            shiftMap[sh].pendingRev += 500;
                        }
                    }
                });
            }
        });

        const totalProjected = totalPaid + totalPending;
        const collectionRate = totalProjected > 0 ? Math.round((totalPaid / totalProjected) * 100) : 0;

        const months = [];
        const trend = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleDateString('en-IN', { month: 'short' }));

            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            let sum = 0;
            libraryStudents.forEach(s => {
                const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);
                if (adm <= mEnd && s.feePaid) {
                    sum += fee;
                }
            });
            trend.push(sum);
        }

        return res.json({
            system: 'Library',
            totalStudents: libraryStudents.length,
            paidCount,
            unpaidCount,
            totalPaid,
            totalPending,
            totalProjected,
            collectionRate,
            shiftBreakdown: shiftMap,
            months,
            trend
        });

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

// Dedicated Library Revenue Analytics Page
router.get('/analytics/library', async (req, res) => {
    try {
        const libraryStudents = await Student.find();

        let totalPaid = 0;
        let totalPending = 0;
        let paidCount = 0;
        let unpaidCount = 0;

        const shiftList = ['6am-10am', '10am-2pm', '2pm-6pm', '6pm-10pm', 'night'];
        const shiftMap = {};
        shiftList.forEach(st => {
            shiftMap[st] = { total: 0, paidCount: 0, unpaidCount: 0, paidRev: 0, pendingRev: 0 };
        });

        libraryStudents.forEach(s => {
            const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);

            if (s.feePaid) {
                totalPaid += fee;
                paidCount++;
            } else {
                totalPending += fee;
                unpaidCount++;
            }

            if (s.shifts && Array.isArray(s.shifts)) {
                s.shifts.forEach(sh => {
                    if (shiftMap[sh]) {
                        shiftMap[sh].total++;
                        if (s.feePaid) {
                            shiftMap[sh].paidCount++;
                            shiftMap[sh].paidRev += 500;
                        } else {
                            shiftMap[sh].unpaidCount++;
                            shiftMap[sh].pendingRev += 500;
                        }
                    }
                });
            }
        });

        const totalProjected = totalPaid + totalPending;
        const collectionRate = totalProjected > 0 ? Math.round((totalPaid / totalProjected) * 100) : 0;

        // 6-Month Trend
        const months = [];
        const trend = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleDateString('en-IN', { month: 'short' }));

            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            let sum = 0;
            libraryStudents.forEach(s => {
                const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                const fee = s.monthlyFee || ((s.shifts && s.shifts.length ? s.shifts.length : 1) * 500);
                if (adm <= mEnd && s.feePaid) {
                    sum += fee;
                }
            });
            trend.push(sum);
        }

        res.render('libraryAnalytics', {
            analytics: {
                totalStudents: libraryStudents.length,
                paidCount,
                unpaidCount,
                totalPaid,
                totalPending,
                totalProjected,
                collectionRate,
                shiftBreakdown: shiftMap,
                chartData: { months, trend }
            }
        });
    } catch (err) {
        console.error('Error rendering library analytics:', err);
        res.render('libraryAnalytics', {
            analytics: {
                totalStudents: 0, paidCount: 0, unpaidCount: 0, totalPaid: 0, totalPending: 0, totalProjected: 0, collectionRate: 0,
                shiftBreakdown: {}, chartData: { months: [], trend: [] }
            }
        });
    }
});

// Dedicated Coaching Revenue Analytics Page
router.get('/analytics/coaching', async (req, res) => {
    try {
        const coachingStudents = await CoachingStudent.find();

        let totalPaid = 0;
        let totalPending = 0;
        let paidCount = 0;
        let unpaidCount = 0;

        const batchMap = {};

        coachingStudents.forEach(s => {
            const fee = Number(s.monthlyFee) || 0;
            const batchName = s.batch || 'General';

            if (!batchMap[batchName]) {
                batchMap[batchName] = { total: 0, paidCount: 0, unpaidCount: 0, paidRev: 0, pendingRev: 0 };
            }

            batchMap[batchName].total++;

            if (s.feePaid) {
                totalPaid += fee;
                paidCount++;
                batchMap[batchName].paidCount++;
                batchMap[batchName].paidRev += fee;
            } else {
                totalPending += fee;
                unpaidCount++;
                batchMap[batchName].unpaidCount++;
                batchMap[batchName].pendingRev += fee;
            }
        });

        const totalProjected = totalPaid + totalPending;
        const collectionRate = totalProjected > 0 ? Math.round((totalPaid / totalProjected) * 100) : 0;

        // 6-Month Trend
        const months = [];
        const trend = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(d.toLocaleDateString('en-IN', { month: 'short' }));

            const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            let sum = 0;
            coachingStudents.forEach(s => {
                const adm = s.admissionDate ? new Date(s.admissionDate) : new Date();
                if (adm <= mEnd && s.feePaid) {
                    sum += Number(s.monthlyFee) || 0;
                }
            });
            trend.push(sum);
        }

        res.render('coachingAnalytics', {
            analytics: {
                totalStudents: coachingStudents.length,
                paidCount,
                unpaidCount,
                totalPaid,
                totalPending,
                totalProjected,
                collectionRate,
                batchBreakdown: batchMap,
                chartData: { months, trend }
            }
        });
    } catch (err) {
        console.error('Error rendering coaching analytics:', err);
        res.render('coachingAnalytics', {
            analytics: {
                totalStudents: 0, paidCount: 0, unpaidCount: 0, totalPaid: 0, totalPending: 0, totalProjected: 0, collectionRate: 0,
                batchBreakdown: {}, chartData: { months: [], trend: [] }
            }
        });
    }
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