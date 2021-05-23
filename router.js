const express = require("express");
const DB = require("./db");
const auth = require("./tokens"); // deals with auth/jwt/tokens
const yahooFinance = require("yahoo-finance");
const e = require("express");
const { v4: uuidv4 } = require("uuid");
const PATHS = {
  homepage: "/home",
};
let router = new express.Router();

// runs in the background
DB.searchForLimitOrStopOrders();

// callback (err, price)
// can be promises or callbacks
function getQuote(ticker, callback = null) {
  if (callback) {
    yahooFinance.quote(
      { symbol: ticker, modules: ["price"] },
      (err, quotes) => {
        if (err) {
          console.log(err);
          callback(err, null);
        } else {
          let price = quotes.price.regularMarketPrice;
          callback(null, price);
        }
      },
    );
  } else {
    return new Promise((resolve, reject) => {
      yahooFinance.quote(
        { symbol: ticker, modules: ["price"] },
        (err, quotes) => {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            let price = quotes.price.regularMarketPrice;
            resolve(price);
          }
        },
      );
    });
  }
}

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

router.get("/purchase", auth.mustBeLoggedIn, async (req, res) => {
  // The `cart` cookie is a stringified array of cart items.
  let cart = [];
  try {
    cart = req.cookies.cart
      ? JSON.parse(decodeURIComponent(req.cookies.cart))
      : null;
  } catch (err) {
    res.cookie("cart", "[]");
    res.redirect("/buy");
    return;
  }
  if (!cart) {
    res.redirect("/buy?alert=There is nothing in your cart.");
    return;
  }

  for (let i = 0; i < cart.length; i++) {
    try {
      cart[i].currentPriceOfOneShare = await getQuote(cart[i].ticker);
    } catch (err) {
      console.log(err);
      cart[i].currentPriceOfOneShare = 0;
    }
  }

  let totalPrice = 0;
  cart.map(
    (order) => (totalPrice += order.quantity * order.currentPriceOfOneShare),
  );

  if (totalPrice > req.person.money) {
    res.redirect(
      "/buy?alert=You do not have enough funds to complete this transaction.",
    );
  } else {
    // complete purchase
    DB.completePurchase(req.person.username, cart, totalPrice, (err) => {
      if (err) {
        res.redirect("/buy?alert=ERROR: An unexpected error has occured.");
      } else {
        // clear cart
        res.cookie("cart", "");
        res.redirect("/holdings?alert=Order placed successfully!");
      }
    });
  }
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
      return;
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

router.get("/holdings", auth.mustBeLoggedIn, (req, res) => {
  res.render("holdings", { title: "Balance & Holdings", person: req.person });
});
router.get(PATHS.homepage, auth.mustBeLoggedIn, (req, res) => {
  // TODO: middleware to check if person is logged on
  // TODO: send all person data in reder method:
  res.render("home", { person: req.person });
});

router.get("/signup", (req, res) => {
  res.render("signup", {});
});

router.get("/buy", auth.mustBeLoggedIn, async (req, res) => {
  // The `cart` cookie is a stringified array of cart items.
  let cart = req.cookies.cart
    ? JSON.parse(decodeURIComponent(req.cookies.cart))
    : null;

  if (cart) {
    for (let i = 0; i < cart.length; i++) {
      try {
        cart[i].currentPriceOfOneShare = await getQuote(cart[i].ticker);
      } catch (err) {
        console.log(err);
        cart[i].currentPriceOfOneShare = 0;
      }
    }
    console.log(cart);
  }
  res.render("buy", { title: "Buy", cart, person: req.person });
});

router.post("/updatecart", (req, res) => {
  let { ticker, quantity, orderType, limitPrice, stopPrice } = req.body;

  getQuote(ticker, (err, price) => {
    if (err) {
      res.redirect("/buy?alert=Error: Ticker symbol not found.");
      return;
    }

    if (orderType == "limit" && limitPrice < price) {
      res.redirect(
        "/buy?alert=Error: Limit order price must be greater than the current price.",
      );
      return;
    } else if (orderType == "stop" && stopPrice > price) {
      res.redirect(
        "/buy?alert=Error: Stop order price must be smaller than the current price.",
      );
      return;
    }

    let order = { orderId: uuidv4() };
    if (orderType == "market") {
      order = { ...order, ticker, quantity };
    } else if (orderType == "limit") {
      order = { ...order, ticker, quantity, limit: limitPrice };
    } else if (orderType == "stop") {
      order = { ...order, ticker, quantity, stop: stopPrice };
    } else {
      //error
      res.redirect(
        "/buy?alert=Error: No order type was selected. This shouldn't happen!",
      );
      return;
    }

    if ("cart" in req.cookies && req.cookies.cart) {
      // need to decodeURIComponent before JSON parsing it.
      let currentCartArray = JSON.parse(decodeURIComponent(req.cookies.cart));
      currentCartArray.push(order);
      res.cookie("cart", JSON.stringify(currentCartArray), {
        maxAge: 900000,
        httpOnly: true,
      });
    } else {
      res.cookie("cart", JSON.stringify([order]), {
        maxAge: 900000,
        httpOnly: true,
      });
    }

    res.redirect("/buy?alert=Successfully added to cart!");
  });
});

// "/quote?ticker=vti"
router.get("/quote", (req, res) => {
  let { ticker } = req.query;

  if (!ticker) {
    res.json({ price: null, err: true });
  } else {
    getQuote(ticker, (err, price) => {
      if (err) {
        console.log(err);
        res.json({ price: null, err: true });
      } else {
        res.json({ price, err: null });
      }
    });
  }
});

router.get("/money", auth.mustBeLoggedIn, (req, res) => {
  res.render("add-money", { title: "Add/Subtract Money", person: req.person });
});

router.post("/money", auth.mustBeLoggedIn, (req, res) => {
  let { addOrSubtract, amount } = req.body;
  DB.addOrSubtractMoney(
    req.person.username,
    addOrSubtract,
    parseInt(amount),
    (err) => {
      if (err) {
        res.send("an error has occured.");
      } else {
        res.redirect("/holdings?alert=Account updated successfully.");
      }
    },
  );
});

router.get("/sell", auth.mustBeLoggedIn, (req, res) => {
  res.render("sell", { title: "Sell", person: req.person });
});

router.post("/sell", auth.mustBeLoggedIn, (req, res) => {
  let { selectedHoldings } = req.body;
  DB.completeSelling(req.person.username, selectedHoldings, (err) => {
    if (err) {
      res.redirect(
        "/sell?alert=ERROR: An error occured while attempting to sell shares.",
      );
    } else {
      res.redirect("/holdings?alert=Holdings sold successfully!");
    }
  });
});

router.get("/removecartitem", (req, res) => {
  let { orderId } = req.query;
  let cart = JSON.parse(decodeURIComponent(req.cookies.cart));
  cart = cart.filter((order) => order.orderId != orderId);
  res.cookie("cart", JSON.stringify(cart), { maxAge: 900000, httpOnly: true });
  res.redirect("/buy?alert=Item removed from cart.");
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
