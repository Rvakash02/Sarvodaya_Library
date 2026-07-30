const cron = require('node-cron');
const Student = require('../models/studentSchema');
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

        // Find all students whose fee is not paid AND whose fee expires on or before warningDate
        const overdueStudents = await Student.find({
            feePaid: false,
            feeExpireDate: { $lte: warningDate }
        });

        console.log(`Found ${overdueStudents.length} unpaid/expiring students for WhatsApp reminders.`);

        for (const student of overdueStudents) {
            const expiryStr = student.feeExpireDate ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) : 'N/A';

            const shiftsStr = student.shifts.join(', ');
            
            const message = `Dear ${student.name},\n\nThis is an automated reminder from Sarvodaya Library.\n\nYour fee status for Seat ${student.seatNumber} (${shiftsStr}) is UNPAID (expires/expired on ${expiryStr}).\n\nPlease renew your fee to continue using your seat allocation.\n\nThank you!`;
            
            // Send message via our WhatsApp service
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
