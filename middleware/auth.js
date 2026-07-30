const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            res.locals.user = decoded;  
            req.user = decoded;  
        } catch (error) {
            res.clearCookie('token'); 
            res.locals.user = null;
        }
    }else {
        res.locals.user = null;
    }

    next();
};

const basicAuth = (req, res, next) => {
    if(req.user == null){
        res.status(403);
        return res.render('login', {error : 'You need to Login first'})
    }
    next();
}
const roleAuth = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            res.status(403);
            return res.render('login', { error: 'Access Denied, Only admin allowed' })
        }
        next();
    }
}

module.exports = {
    authenticateUser,
    basicAuth,
    roleAuth,
}