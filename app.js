const express = require('express');
const app = express();
const connectDB = require('./database/connectDB')
require('dotenv').config();
const userRoutes = require('./routes/userRoutes')
const path = require("path");
const { authenticateUser, basicAuth, roleAuth} = require('./middleware/auth')
const cookieParser = require('cookie-parser');
const dashboardRoutes = require('./routes/dashboardRoutes');

//middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(authenticateUser);

//routes
app.use('/user',userRoutes);
app.use('/admin', dashboardRoutes);

//listen to port
connectDB();

// Initialize WhatsApp Web Client & Cron Schedulers
const { initWhatsApp } = require('./services/whatsapp');
const { initScheduler } = require('./services/scheduler');
initWhatsApp();
initScheduler();

const PORT = process.env.PORT || 3001
app.listen(PORT, ()=>{
    console.log(`Server running at Port : ${PORT}`);  
});