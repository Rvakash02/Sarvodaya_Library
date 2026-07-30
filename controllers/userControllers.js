const User = require("../models/userSchema");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    try {
         const hashedPassword = await bcrypt.hash(req.body.password, 10);
         const newUser = new User({
                    ...req.body,
                    password: hashedPassword,
                    });
        await newUser.save();
        res.status(201).json({newUser ,message: "Registration successful" });
    } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
}
};

const login = async(req, res) => {
    try {
        const {email, password} = req.body ;
        const user = await User.findOne({email})

        const isUserValid = user && await bcrypt.compare(password, user.password) ;

        if(!isUserValid){
            return res.render('login', { error: "Wrong email or Password" });
        }
        
        const token = jwt.sign(
            {id: user._id, role: user.role}, 
            process.env.JWT_SECRET, 
            {expiresIn: '12h'}
        )

        res.cookie('token', token, {
            httpOnly: true, 
            maxAge: 12 * 60 * 60 * 1000 
        });
        res.redirect('/admin/dashboard');

    } catch (error) {
        res.status(500).json("Login failed");
    }
};

const logout = (req, res) => {
    res.clearCookie('token'); // Removes the JWT cookie from the browser
    res.redirect('/user/login'); // Redirects user back to login screen
};

module.exports = {
  register,
  login,
  logout,
};
