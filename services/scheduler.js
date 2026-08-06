const cron = require('node-cron');
const Student = require('../models/studentSchema');
const CoachingStudent = require('../models/coachingStudentSchema');
const { sendWhatsAppMessage } = require('./whatsapp');

/**
 * Reminder Schedule:
 *   • 3 days BEFORE expiry  →  "Your fee will expire in 3 days"
 *   • ON expiry date        →  "Your fee expires today"
 *   • AFTER expiry          →  every 3 days (day 3, 6, 9, 12…)
 *
 * Cron runs daily at 9:00 AM. Each run checks which students
 * qualify for a reminder TODAY based on their feeExpireDate.
 */

function initScheduler() {
    console.log('Initializing Cron Scheduler for WhatsApp Reminders...');

    // Runs every day at 9:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('[Scheduler] Running daily reminder check at 9:00 AM...');
        await runDailyReminders();
    });
}

/**
 * Get the start of a given date (00:00:00.000)
 */
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Calculate difference in calendar days between two dates.
 * Positive = date1 is after date2, Negative = date1 is before date2
 */
function daysDiff(date1, date2) {
    const d1 = startOfDay(date1);
    const d2 = startOfDay(date2);
    return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a student should receive a reminder today.
 * Returns the reminder type string, or null if no reminder today.
 */
function shouldRemindToday(feeExpireDate) {
    if (!feeExpireDate) return null;

    const today = new Date();
    const daysUntilExpiry = daysDiff(startOfDay(feeExpireDate), startOfDay(today));
    // daysUntilExpiry > 0 means fee expires in the future
    // daysUntilExpiry = 0 means fee expires today
    // daysUntilExpiry < 0 means fee already expired

    // 3 days before expiry
    if (daysUntilExpiry === 3) return 'PRE_EXPIRY';

    // On the expiry date
    if (daysUntilExpiry === 0) return 'EXPIRY_DAY';

    // After expiry: every 3 days (day 3, 6, 9, 12, ...)
    if (daysUntilExpiry < 0) {
        const daysPastExpiry = Math.abs(daysUntilExpiry);
        if (daysPastExpiry % 3 === 0) return 'POST_EXPIRY';
    }

    return null;
}

/**
 * Build the reminder message based on type.
 */
function buildMessage(student, type, isCoaching = false) {
    const name = student.name;
    const expiryStr = student.feeExpireDate
        ? new Date(student.feeExpireDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : 'N/A';

    const source = isCoaching ? 'Sarvodaya Coaching Classes' : 'Sarvodaya Library';
    const seatInfo = isCoaching
        ? `Batch: ${student.batch}`
        : `Seat ${student.seatNumber} (${student.shifts ? student.shifts.join(', ') : 'All Shifts'})`;

    if (type === 'PRE_EXPIRY') {
        return (
            `Dear ${name},\n\n` +
            `This is a reminder from ${source}.\n\n` +
            `Your fee for ${seatInfo} will expire on ${expiryStr} (in 3 days).\n\n` +
            `Please renew your fee before the expiry date to avoid any interruption.\n\n` +
            `Thank you!`
        );
    }

    if (type === 'EXPIRY_DAY') {
        return (
            `Dear ${name},\n\n` +
            `This is an urgent reminder from ${source}.\n\n` +
            `Your fee for ${seatInfo} expires TODAY (${expiryStr}).\n\n` +
            `Please renew your fee immediately to continue your services.\n\n` +
            `Thank you!`
        );
    }

    // POST_EXPIRY
    const daysPast = Math.abs(daysDiff(startOfDay(new Date()), startOfDay(student.feeExpireDate)));
    return (
        `Dear ${name},\n\n` +
        `This is a reminder from ${source}.\n\n` +
        `Your fee for ${seatInfo} expired on ${expiryStr} (${daysPast} days ago) and is still UNPAID.\n\n` +
        `Please renew your fee at the earliest to continue using your allocation.\n\n` +
        `Thank you!`
    );
}

async function runDailyReminders() {
    try {
        // ── 1. Pre-expiry reminders (fee still paid, expires in exactly 3 days) ──
        const threeDaysLater = new Date();
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        const dayStart = startOfDay(threeDaysLater);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const preExpiryLibrary = await Student.find({
            feePaid: true,
            feeExpireDate: { $gte: dayStart, $lte: dayEnd },
        });

        const preExpiryCoaching = await CoachingStudent.find({
            feePaid: true,
            feeExpireDate: { $gte: dayStart, $lte: dayEnd },
        });

        console.log(`[Scheduler] Pre-expiry (3 days): ${preExpiryLibrary.length} library, ${preExpiryCoaching.length} coaching`);

        for (const s of preExpiryLibrary) {
            await sendWhatsAppMessage(s.phone, buildMessage(s, 'PRE_EXPIRY', false));
        }
        for (const s of preExpiryCoaching) {
            await sendWhatsAppMessage(s.phone, buildMessage(s, 'PRE_EXPIRY', true));
        }

        // ── 2. Expiry day + Post-expiry reminders (fee unpaid / expired) ──
        const todayStart = startOfDay(new Date());
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);

        // Students whose fee expires today OR has already expired
        const expiredLibrary = await Student.find({
            feeExpireDate: { $lte: todayEnd },
        });

        const expiredCoaching = await CoachingStudent.find({
            feeExpireDate: { $lte: todayEnd },
        });

        let librarySent = 0;
        let coachingSent = 0;

        for (const s of expiredLibrary) {
            // Skip students who already paid (only expired but paid = no reminder needed)
            if (s.feePaid && daysDiff(startOfDay(s.feeExpireDate), todayStart) !== 0) continue;

            const type = shouldRemindToday(s.feeExpireDate);
            if (!type || type === 'PRE_EXPIRY') continue; // pre-expiry handled above

            await sendWhatsAppMessage(s.phone, buildMessage(s, type, false));
            librarySent++;
        }

        for (const s of expiredCoaching) {
            if (s.feePaid && daysDiff(startOfDay(s.feeExpireDate), todayStart) !== 0) continue;

            const type = shouldRemindToday(s.feeExpireDate);
            if (!type || type === 'PRE_EXPIRY') continue;

            await sendWhatsAppMessage(s.phone, buildMessage(s, type, true));
            coachingSent++;
        }

        console.log(`[Scheduler] Expiry/Post-expiry: ${librarySent} library, ${coachingSent} coaching reminders sent.`);

    } catch (err) {
        console.error('[Scheduler] Error running daily reminders:', err);
    }
}

module.exports = {
    initScheduler,
    runDailyReminders,
};
