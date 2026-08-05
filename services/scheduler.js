const cron = require('node-cron');
const Student = require('../models/studentSchema');
const CoachingStudent = require('../models/coachingStudentSchema');
const { sendWhatsAppMessage } = require('./whatsapp');

// Runs daily at 9:00 AM
function initScheduler() {
    console.log('Initializing Cron Scheduler for WhatsApp Reminders...');
    
    // cron pattern: minute hour day-of-month month day-of-week
    cron.schedule('0 9 * * *', async () => {
        console.log('Running daily WhatsApp pre-expiry check at 9:00 AM...');
        await runDailyReminders();
    });
}

async function runDailyReminders() {
    try {
        // Calculate date 3 days from now
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + 3);
        // Set warningDate to end of that day (23:59:59) to make sure we capture all expiry dates within 3 days
        warningDate.setHours(23, 59, 59, 999);

        // 1. Library Reminders
        const overdueLibraryStudents = await Student.find({
            feePaid: false,
            feeExpireDate: { $lte: warningDate }
        });

        console.log(`Found ${overdueLibraryStudents.length} unpaid/expiring library students for WhatsApp reminders.`);

        for (const student of overdueLibraryStudents) {
            const expiryStr = student.feeExpireDate ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) : 'N/A';

            const shiftsStr = student.shifts ? student.shifts.join(', ') : 'All Shifts';
            const message = `Dear ${student.name},\n\nThis is an automated reminder from Sarvodaya Library.\n\nYour fee status for Seat ${student.seatNumber} (${shiftsStr}) is UNPAID (expires/expired on ${expiryStr}).\n\nPlease renew your fee to continue using your seat allocation.\n\nThank you!`;
            
            await sendWhatsAppMessage(student.phone, message);
        }

        // 2. Coaching Reminders
        const overdueCoachingStudents = await CoachingStudent.find({
            feePaid: false,
            feeExpireDate: { $lte: warningDate }
        });

        console.log(`Found ${overdueCoachingStudents.length} unpaid/expiring coaching students for WhatsApp reminders.`);

        for (const student of overdueCoachingStudents) {
            const expiryStr = student.feeExpireDate ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) : 'N/A';

            const message = `Dear ${student.name},\n\nThis is an automated reminder from Sarvodaya Coaching Classes.\n\nYour fee status for Batch: ${student.batch} is UNPAID (expires/expired on ${expiryStr}).\n\nPlease renew your monthly fee to continue your classes.\n\nThank you!`;

            await sendWhatsAppMessage(student.phone, message);
        }

    } catch (err) {
        console.error('Error executing daily WhatsApp reminders:', err);
    }
}

module.exports = {
    initScheduler,
    runDailyReminders
};

