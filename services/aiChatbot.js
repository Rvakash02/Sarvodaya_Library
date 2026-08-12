const { GoogleGenAI } = require('@google/genai');
const Student = require('../models/studentSchema');

// Lazy initialization of Gemini client to prevent startup warnings when key is missing
let aiClient = null;
function getAIClient() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('your_gemini_api_key')) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// In-memory session management
// Format: sessionId -> { history: Array, undoStack: Array }
const chatSessions = new Map();

const TOTAL_SEATS = 43;
const ALL_SHIFTS = ['6am-10am', '10am-2pm', '2pm-6pm', '6pm-10pm', 'night'];

const SYSTEM_PROMPT = `You are the AI assistant for Sarvodaya Library. The library has 43 seats (1-43) and 5 shifts. You help the admin manage seats efficiently. You can find vacant seats, suggest rearrangements, look up students, provide fee/revenue insights, and execute seat changes. Always be concise and helpful. When suggesting rearrangements, explain clearly which students need to move where and why. When performing actions, always ask for confirmation first. Format amounts in Indian Rupees (₹). Use English.`;

// ------------------------------------------------------------------
// Tool Definitions for Gemini
// ------------------------------------------------------------------
const tools = [{
  functionDeclarations: [
    {
      name: 'getVacantSeats',
      description: 'Find seats vacant across ALL given shifts',
      parameters: {
        type: 'OBJECT',
        properties: {
          shifts: {
            type: 'ARRAY',
            items: { type: 'STRING', enum: ALL_SHIFTS },
            description: 'List of shifts to check for vacancy'
          }
        },
        required: ['shifts']
      }
    },
    {
      name: 'getStudentByName',
      description: 'Search for a student by their name',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: {
            type: 'STRING',
            description: 'Name or partial name of the student'
          }
        },
        required: ['name']
      }
    },
    {
      name: 'getStudentBySeat',
      description: 'Get student info on a specific seat',
      parameters: {
        type: 'OBJECT',
        properties: {
          seatNumber: {
            type: 'NUMBER',
            description: 'Seat number (1-43)'
          }
        },
        required: ['seatNumber']
      }
    },
    {
      name: 'getAllStudents',
      description: 'Get filtered student list',
      parameters: {
        type: 'OBJECT',
        properties: {
          status: {
            type: 'STRING',
            enum: ['paid', 'unpaid', 'all'],
            description: 'Filter by fee status'
          },
          shift: {
            type: 'STRING',
            enum: ALL_SHIFTS,
            description: 'Filter by specific shift'
          }
        }
      }
    },
    {
      name: 'getOccupancyStats',
      description: 'Get shift-wise occupancy counts, revenue collected vs pending, total students',
      parameters: {
        type: 'OBJECT',
        properties: {}
      }
    },
    {
      name: 'swapStudentSeats',
      description: 'Swap seat numbers of two students',
      parameters: {
        type: 'OBJECT',
        properties: {
          studentId1: {
            type: 'STRING',
            description: 'MongoDB ID of the first student'
          },
          studentId2: {
            type: 'STRING',
            description: 'MongoDB ID of the second student'
          }
        },
        required: ['studentId1', 'studentId2']
      }
    },
    {
      name: 'moveStudentToSeat',
      description: 'Move a student to a new seat',
      parameters: {
        type: 'OBJECT',
        properties: {
          studentId: {
            type: 'STRING',
            description: 'MongoDB ID of the student'
          },
          newSeatNumber: {
            type: 'NUMBER',
            description: 'Target seat number (1-43)'
          }
        },
        required: ['studentId', 'newSeatNumber']
      }
    },
    {
      name: 'findRearrangementPlan',
      description: 'Find a plan to free up a seat for the given shifts by suggesting minimal swaps',
      parameters: {
        type: 'OBJECT',
        properties: {
          targetShifts: {
            type: 'ARRAY',
            items: { type: 'STRING', enum: ALL_SHIFTS },
            description: 'List of shifts that need to be freed on a single seat'
          }
        },
        required: ['targetShifts']
      }
    }
  ]
}];

// ------------------------------------------------------------------
// Tool Implementations
// ------------------------------------------------------------------

async function getVacantSeats({ shifts }) {
  const students = await Student.find({ shifts: { $in: shifts } }).lean();
  
  // Track occupied seats
  const occupiedSeats = new Set();
  for (const student of students) {
    // If student occupies the seat in ANY of the target shifts, the seat is not completely vacant for ALL those shifts
    const overlaps = student.shifts.some(s => shifts.includes(s));
    if (overlaps && student.seatNumber) {
      occupiedSeats.add(student.seatNumber);
    }
  }

  const vacantSeats = [];
  for (let i = 1; i <= TOTAL_SEATS; i++) {
    if (!occupiedSeats.has(i)) {
      vacantSeats.push(i);
    }
  }

  return { vacantSeats, totalVacant: vacantSeats.length };
}

async function getStudentByName({ name }) {
  const students = await Student.find({ name: new RegExp(name, 'i') }).lean();
  return { students };
}

async function getStudentBySeat({ seatNumber }) {
  const students = await Student.find({ seatNumber }).lean();
  return { students, seatNumber };
}

async function getAllStudents({ status = 'all', shift }) {
  const query = {};
  if (status === 'paid') query.feePaid = true;
  if (status === 'unpaid') query.feePaid = false;
  if (shift) query.shifts = shift;

  const students = await Student.find(query).lean();
  return { total: students.length, students };
}

async function getOccupancyStats() {
  const students = await Student.find({}).lean();
  
  const stats = {
    totalStudents: students.length,
    shiftOccupancy: {
      '6am-10am': 0, '10am-2pm': 0, '2pm-6pm': 0, '6pm-10pm': 0, 'night': 0
    },
    revenueCollected: 0,
    revenuePending: 0
  };

  for (const student of students) {
    if (Array.isArray(student.shifts)) {
      for (const shift of student.shifts) {
        if (stats.shiftOccupancy[shift] !== undefined) {
          stats.shiftOccupancy[shift]++;
        }
      }
    }
    
    const fee = Number(student.monthlyFee) || 0;
    if (student.feePaid) {
      stats.revenueCollected += fee;
    } else {
      stats.revenuePending += fee;
    }
  }

  return stats;
}

// Helper to push to undo stack
function pushToUndoStack(sessionId, operation) {
  if (!chatSessions.has(sessionId)) return;
  chatSessions.get(sessionId).undoStack.push(operation);
}

async function swapStudentSeats({ studentId1, studentId2 }, sessionId) {
  const s1 = await Student.findById(studentId1);
  const s2 = await Student.findById(studentId2);

  if (!s1 || !s2) {
    return { error: 'One or both students not found.' };
  }

  // Before executing, push undo data
  pushToUndoStack(sessionId, {
    type: 'swap',
    data: {
      studentId1: s1._id.toString(),
      studentId2: s2._id.toString()
    }
  });

  const tempSeat = s1.seatNumber;
  s1.seatNumber = s2.seatNumber;
  s2.seatNumber = tempSeat;

  await s1.save();
  await s2.save();

  return { 
    success: true, 
    message: `Successfully swapped seats between ${s1.name} (now seat ${s1.seatNumber}) and ${s2.name} (now seat ${s2.seatNumber}).` 
  };
}

async function moveStudentToSeat({ studentId, newSeatNumber }, sessionId) {
  const student = await Student.findById(studentId);
  if (!student) return { error: 'Student not found.' };

  // Check if target seat is vacant for the student's shifts
  const blockingStudents = await Student.find({
    seatNumber: newSeatNumber,
    shifts: { $in: student.shifts }
  });

  // A student can't block themselves, so filter out if it's the same student (though moving to same seat is a no-op)
  const actualBlockers = blockingStudents.filter(s => s._id.toString() !== studentId.toString());

  if (actualBlockers.length > 0) {
    return { 
      error: `Seat ${newSeatNumber} is not vacant for shifts: ${student.shifts.join(', ')}. Blocked by: ${actualBlockers.map(s => s.name).join(', ')}` 
    };
  }

  // Before executing, push undo data
  pushToUndoStack(sessionId, {
    type: 'move',
    data: {
      studentId: student._id.toString(),
      oldSeatNumber: student.seatNumber
    }
  });

  const oldSeat = student.seatNumber;
  student.seatNumber = newSeatNumber;
  await student.save();

  return {
    success: true,
    message: `Successfully moved ${student.name} from seat ${oldSeat} to seat ${newSeatNumber}.`
  };
}

async function findRearrangementPlan({ targetShifts }) {
  // Get all students
  const students = await Student.find({ seatNumber: { $exists: true, $ne: null } }).lean();
  
  // Group by seat
  const seatMap = new Map();
  for (let i = 1; i <= TOTAL_SEATS; i++) {
    seatMap.set(i, []);
  }
  for (const student of students) {
    if (student.seatNumber >= 1 && student.seatNumber <= TOTAL_SEATS) {
      seatMap.get(student.seatNumber).push(student);
    }
  }

  const vacantSeats = [];
  const partialSeats = [];

  for (let [seat, occupants] of seatMap.entries()) {
    const occupiedShifts = new Set();
    occupants.forEach(s => s.shifts.forEach(shift => occupiedShifts.add(shift)));

    const targetOverlap = targetShifts.filter(ts => occupiedShifts.has(ts));
    
    if (targetOverlap.length === 0) {
      vacantSeats.push(seat);
    } else if (targetOverlap.length < targetShifts.length) {
      partialSeats.push({ seat, occupants, overlappingShifts: targetOverlap });
    }
  }

  if (vacantSeats.length > 0) {
    return { 
      plan: `Good news! No rearrangement needed. The following seats are already vacant for ${targetShifts.join(', ')}: ${vacantSeats.join(', ')}` 
    };
  }

  // Find a simple plan: Move one person from a partially conflicting seat to a seat that is vacant for THEIR shifts.
  for (const partial of partialSeats) {
    const seat = partial.seat;
    const occupants = partial.occupants;
    
    // Find the occupants who are conflicting with our targetShifts
    const blockers = occupants.filter(s => s.shifts.some(shift => targetShifts.includes(shift)));
    
    // For simplicity, we try to move a single blocker.
    if (blockers.length === 1) {
      const blocker = blockers[0];
      
      // Where can we move this blocker? They need a seat vacant in ALL their shifts.
      let possibleAlternativeSeats = [];
      for (let i = 1; i <= TOTAL_SEATS; i++) {
        if (i === seat) continue;
        const otherOccupants = seatMap.get(i);
        const otherOccupiedShifts = new Set();
        otherOccupants.forEach(s => s.shifts.forEach(shift => otherOccupiedShifts.add(shift)));
        
        const conflict = blocker.shifts.some(shift => otherOccupiedShifts.has(shift));
        if (!conflict) {
          possibleAlternativeSeats.push(i);
        }
      }

      if (possibleAlternativeSeats.length > 0) {
        return {
          plan: `To free up seat ${seat} for shifts [${targetShifts.join(', ')}], you can move student '${blocker.name}' (who occupies it during ${blocker.shifts.join(', ')}) to seat ${possibleAlternativeSeats[0]}.`
        };
      }
    }
  }

  return { plan: `Could not find a simple 1-step rearrangement plan to free up a seat for shifts: ${targetShifts.join(', ')}. Manual adjustment might be needed.` };
}

const functionImplementations = {
  getVacantSeats,
  getStudentByName,
  getStudentBySeat,
  getAllStudents,
  getOccupancyStats,
  swapStudentSeats,
  moveStudentToSeat,
  findRearrangementPlan
};

// ------------------------------------------------------------------
// Main Exports
// ------------------------------------------------------------------

const FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite'
];

async function generateWithModelFallback(ai, contents, config) {
  let lastError = null;
  for (const modelName of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config
      });
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelName} encountered error (${err.status || err.message}), trying fallback model...`);
      continue;
    }
  }
  throw lastError;
}

/**
 * Handle a chat message from the user
 * @param {string} message - User's message
 * @param {string} sessionId - Unique session ID
 * @returns {Object} - { reply: string, actions: array, canUndo: boolean }
 */
async function handleChatMessage(message, sessionId) {
  const ai = getAIClient();
  if (!ai) {
    return {
      reply: '⚠️ **API Key Required**: Please add your `GEMINI_API_KEY` to the `.env` file to enable the AI assistant.\n\nYou can get a free API key from [Google AI Studio](https://aistudio.google.com/).',
      actions: [],
      canUndo: false
    };
  }

  // Initialize session if not exists
  if (!chatSessions.has(sessionId)) {
    chatSessions.set(sessionId, {
      history: [],
      undoStack: []
    });
  }

  const session = chatSessions.get(sessionId);

  try {
    // Append user message
    session.history.push({ role: 'user', parts: [{ text: message }] });

    let finalResponseText = '';
    
    // Function calling loop
    while (true) {
      const response = await generateWithModelFallback(ai, session.history, {
        tools,
        systemInstruction: SYSTEM_PROMPT,
      });

      // Handle function calls
      if (response.functionCalls && response.functionCalls.length > 0) {
        // Record exact model content (including thought signatures) in history
        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
          session.history.push(response.candidates[0].content);
        } else {
          session.history.push({
            role: 'model',
            parts: response.functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args } }))
          });
        }

        // Execute functions and collect responses
        const functionResponsesParts = [];
        for (const call of response.functionCalls) {
          const fn = functionImplementations[call.name];
          if (fn) {
            try {
              // Pass sessionId to mutating functions for undo support
              let result;
              if (call.name === 'swapStudentSeats' || call.name === 'moveStudentToSeat') {
                result = await fn(call.args, sessionId);
              } else {
                result = await fn(call.args);
              }
              
              functionResponsesParts.push({
                functionResponse: {
                  name: call.name,
                  response: result
                }
              });
            } catch (err) {
              functionResponsesParts.push({
                functionResponse: {
                  name: call.name,
                  response: { error: err.message }
                }
              });
            }
          }
        }

        // Add function execution results to history and continue loop
        session.history.push({
          role: 'user',
          parts: functionResponsesParts
        });
      } else if (response.text) {
        // Final text response
        finalResponseText = response.text;
        session.history.push({ role: 'model', parts: [{ text: finalResponseText }] });
        break; // Exit loop
      } else {
        // Fallback for unexpected empty response
        finalResponseText = "I couldn't process that. Please try again.";
        session.history.push({ role: 'model', parts: [{ text: finalResponseText }] });
        break;
      }
    }

    return {
      reply: finalResponseText,
      actions: [], // You can populate this if UI needs specific action metadata
      canUndo: session.undoStack.length > 0
    };
  } catch (error) {
    console.error('Gemini AI Error:', error);
    let userMsg = 'Sorry, an error occurred while processing your request.';
    if (error.status === 429 || (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')))) {
      userMsg = '⏳ **Google Free Tier Quota Limit Reached**: The free Google AI Studio quota limit has been reached for this minute. Please wait ~45 seconds and try again!';
    } else {
      userMsg = `Sorry, an error occurred: ${error.message || 'Unknown error'}`;
    }
    return {
      reply: userMsg,
      actions: [],
      canUndo: session ? session.undoStack.length > 0 : false
    };
  }
}

/**
 * Reverts the last action performed in the session
 * @param {string} sessionId 
 * @returns {Object} - { reply: string, success: boolean }
 */
async function undoLastAction(sessionId) {
  if (!chatSessions.has(sessionId)) {
    return { reply: 'No active session found.', success: false };
  }

  const session = chatSessions.get(sessionId);
  if (session.undoStack.length === 0) {
    return { reply: 'Nothing to undo.', success: false };
  }

  const lastAction = session.undoStack.pop();

  try {
    if (lastAction.type === 'swap') {
      const s1 = await Student.findById(lastAction.data.studentId1);
      const s2 = await Student.findById(lastAction.data.studentId2);
      
      if (s1 && s2) {
        const temp = s1.seatNumber;
        s1.seatNumber = s2.seatNumber;
        s2.seatNumber = temp;
        await s1.save();
        await s2.save();
        return { reply: `Undo successful: Swapped ${s1.name} and ${s2.name} back to their previous seats.`, success: true };
      }
    } else if (lastAction.type === 'move') {
      const s = await Student.findById(lastAction.data.studentId);
      if (s) {
        s.seatNumber = lastAction.data.oldSeatNumber;
        await s.save();
        return { reply: `Undo successful: Moved ${s.name} back to seat ${s.seatNumber}.`, success: true };
      }
    }
    
    return { reply: 'Could not undo action: students may have been modified or deleted.', success: false };
  } catch (error) {
    console.error('Undo Error:', error);
    return { reply: 'Failed to undo due to a database error.', success: false };
  }
}

/**
 * Clears a session to free up memory
 * @param {string} sessionId 
 */
function clearSession(sessionId) {
  chatSessions.delete(sessionId);
}

module.exports = {
  handleChatMessage,
  undoLastAction,
  clearSession
};
