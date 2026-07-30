const express = require('express');
const router = express.Router();
const { addStudent, getDashboardData, renewFees, updateStudent, deleteStudent } = require('../controllers/studentControllers');
const { basicAuth, roleAuth } = require('../middleware/auth');

const { getWhatsAppStatus, sendWhatsAppMessage } = require('../services/whatsapp');

// Protect all endpoints in this router to be accessed ONLY by authenticated admin users
router.use(basicAuth);
router.use(roleAuth('admin'));

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

router.post('/register', addStudent);
router.get('/register', (req, res) => {
    res.render('addStudent')
});
router.get('/dashboard-data', getDashboardData);
router.get('/dashboard', (req, res) => {
    res.render('dashboard');
});
router.post('/renew-fee', renewFees);
router.post('/update-student', updateStudent);
router.post('/delete-student', deleteStudent);

module.exports = router;