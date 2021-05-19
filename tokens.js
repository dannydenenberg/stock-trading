const jwt = require("jsonwebtoken");
const TOKEN_NAME = "token";
const dotenv = require("dotenv");
const DB = require("./db");
dotenv.config();

module.exports.setTokenInResponse = (res, username) => {
  let token = generateToken({ username });

  // TODO: create token with username as data
  res.cookie(TOKEN_NAME, token, { maxAge: 900000, httpOnly: true });
};

module.exports.destroyLoggedInToken = (res) => {
  res.cookie(TOKEN_NAME, "");
};

/**
 * Checks if req is from a logged in person.
 * If so, it saves the person's database info in req.person.
 * Otherwise, it redirects to the login page.
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
module.exports.mustBeLoggedIn = (req, res, next) => {
  let token = req.cookies[TOKEN_NAME];
  verifyToken(token)
    .then((data) => {
      let person = DB.getPerson(data.username, (err, person) => {
        if (err) {
          res.redirect("/logon");
        } else {
          req.person = person;
          next();
        }
      });
    })
    .catch((err) => {
      // send user back to login page
      res.redirect("/logon");
    });
};

// TODO: fix this

const { JWT_TOKEN_SECRET } = process.env;
const expiresIn = "3456000s"; // = 40 days

/** The 'data' passed looks like this:
 * {username: "zach1"} **/
const generateToken = (data) => {
  return jwt.sign(data, JWT_TOKEN_SECRET, { expiresIn });
};

/** Verifying a token uses promises. **/
const verifyToken = (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_TOKEN_SECRET, (err, data) => {
      if (err) return reject(err); // token is invalid
      resolve(data); // token in valid
    });
  });
};
