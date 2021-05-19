const express = require("express");
const DB = require("./db");
const auth = require("./tokens"); // deals with auth/jwt/tokens
const PATHS = {
  homepage: "/home",
};
let router = new express.Router();

router.get("/", function (req, res) {
  res.render("index", {
    favorite: "Eta",
    name: "Danny",
    reasons: ["fast", "lightweight", "simple"],
  });
});

router.get("/logon", (req, res) => {
  res.render("logon", {});
});

router.post("/logon", (req, res) => {
  let { username, password } = req.body;

  DB.passwordIsCorrect(username, password, (err, isCorrect) => {
    if (err) {
      res.render("logon", {
        alert: true,
        alertType: "primary",
        alertMessage: "⚠️ An error has occurred. Please try again.",
      });
    }
    if (!isCorrect) {
      res.render("logon", {
        alert: true,
        alertType: "primary",
        alertMessage: "⚠️ Username or password not correct.",
      });
    } else {
      // generate token
      auth.setTokenInResponse(res, username);
      res.redirect(PATHS.homepage);
    }
  });
});

router.get("/logout", (req, res) => {
  auth.destroyLoggedInToken(res);
  res.redirect("/logon");
});

router.get(PATHS.homepage, auth.mustBeLoggedIn, (req, res) => {
  // TODO: middleware to check if person is logged on
  // TODO: send all person data in reder method:
  res.render("home", { person: req.person });
});

router.get("/signup", (req, res) => {
  res.render("signup", {});
});

router.get("/checkout", (req, res) => {
  res.render("checkout", {});
});

router.post("/signup", (req, res) => {
  let { username, password1, password2 } = req.body;

  if (password1 != password2) {
    res.render("signup", {
      alert: true,
      alertType: "primary",
      alertMessage: "⚠️ Passwords didn't match.",
    });
  } else {
    DB.createPerson(username, password1, (err) => {
      if (!err) {
        auth.setTokenInResponse(res, username);
        res.redirect(PATHS.homepage);
      } else {
        res.render("signup", {
          alert: true,
          alertType: "primary",
          alertMessage: "⚠️ Username already exists.",
        });
      }
    });
  }
});

module.exports = router;
