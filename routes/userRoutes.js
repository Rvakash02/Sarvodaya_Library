const express = require('express')
const router = express.Router();
const {register,login, logout} = require('../controllers/userControllers')

router.get('/login', (req, res) => {
   res.render('login', { error: null });
});
router.get('/contact', (req, res) => {
   res.render('contact');
});
router.get('/liveseats', (req, res) => {
   res.render('liveseats');
});

const Student = require('../models/studentSchema');

router.get('/liveseats-data', async (req, res) => {
    try {
        let shiftsArray = [];
        if (req.query.shifts) {
            shiftsArray = Array.isArray(req.query.shifts) 
                ? req.query.shifts 
                : req.query.shifts.split(',');
        } else if (req.query.shift) {
            shiftsArray = req.query.shift.split(',');
        }

        if (shiftsArray.length === 0) {
            return res.status(400).json({ error: "At least one shift is required." });
        }

        // Run lazy update to mark expired students as unpaid
        await Student.updateMany(
            { feeExpireDate: { $lt: new Date() }, feePaid: true },
            { $set: { feePaid: false } }
        );

        // Find occupied seats for any of the selected shifts
        const occupiedStudents = await Student.find({ shifts: { $in: shiftsArray } });
        const occupiedSeats = occupiedStudents.map(s => s.seatNumber);

        // Find remaining vacant seats (from 1 to 43)
        const vacantSeats = [];
        for (let i = 1; i <= 43; i++) {
            if (!occupiedSeats.includes(i)) {
                vacantSeats.push(i);
            }
        }

        res.json({ vacantSeats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/logout', logout)

router.post('/register', register);
router.post('/login', login);

module.exports = router;