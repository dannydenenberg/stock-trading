var crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const yahooFinance = require("yahoo-finance");
const Person = require("./models/person");

/**
 * Creates a new person in the database.
 * @param {*} username
 * @param {*} password
 * @param {*} callback (err: true | false)
 */
module.exports.createPerson = (username, password, callback) => {
  // create person
  let hashedPassword = hash(password);
  let newPerson = new Person({
    username,
    password: hashedPassword,
  });

  newPerson
    .save()
    .then((d) => callback(null))
    .catch((err) => callback(err));
};

/**
 * Is the username/password combo correct.
 * @param {*} username
 * @param {*} password
 * @param {*} callback (err, isCorrect: boolean)
 */
module.exports.passwordIsCorrect = (username, password, callback) => {
  Person.find({ username }, (err, docs) => {
    if (err) {
      callback(err, null);
    } else {
      let passwordCorrect = docs[0].password;
      if (hash(password) == passwordCorrect) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    }
  });
};

/**
 * Complete the selling of holdings:
 *    - find the total of the amount of money the shares are worth
 *    - remove them from the holdings
 *    - add new sell transaction to the list
 *    - add the money to the account balance
 * @param {*} username
 * List of Order Ids of the holdings they want to sell:
 * @param {*} listOfSellingOrderIds = ['40ac7bd7-31ca-430c-b894-d91117c03b30','bca354dd-3bcc-468d-bac3-723af394276e',...]
 * @param {*} callback = function(err)
 */
module.exports.completeSelling = async (
  username,
  listOfSellingOrderIds,
  callback,
) => {
  for (let i = 0; i < database.length; i++) {
    if (database[i].username == username) {
      // it's the person

      // get total price
      let holdingsToSell = database[i].holdings.filter((order) =>
        listOfSellingOrderIds.includes(order.orderId),
      );

      // get current prices
      for (let j = 0; j < holdingsToSell.length; j++) {
        holdingsToSell[j] = {
          ...holdingsToSell[j],
          currentPriceOfOneShare: await getQuote(holdingsToSell[j].ticker),
        };
      }

      let totalSellingPrice = 0;
      holdingsToSell.map((order) => {
        totalSellingPrice += order.currentPriceOfOneShare * order.quantity;
        return 0;
      });

      // update money
      database[i].money += totalSellingPrice;

      // update holdings to not include sold stocks
      database[i].holdings = database[i].holdings.filter(
        (order) => !listOfSellingOrderIds.includes(order.orderId),
      );

      // update transactions
      database[i].transactions.push({
        transactionType: "sell",
        transactionId: uuidv4(),
        date: new Date(),
        stocks: holdingsToSell,
      });

      // send callback
      callback(null);
      break;
    }
  }
};

/**
 * Takes a person's cart and
 * - adds cart to holdings
 * - subtracts total amount from the person's money
 * - update TRANSACTIONS
 * @param {*} username
 * @param {*} cart -- already has the cart[i].currentPriceOfOneShare
 * @param {*} callback(err)
 */
module.exports.completePurchase = (username, cart, totalPrice, callback) => {
  for (let i = 0; i < cart.length; i++) {
    cart[i].date = new Date();
  }
  for (let i = 0; i < database.length; i++) {
    if (database[i].username == username) {
      // it's the person

      // update money
      database[i].money -= totalPrice;

      // update holdings
      database[i].holdings = database[i].holdings.concat(cart);
      console.log(`CART`);
      console.log(cart);

      // update transactions
      database[i].transactions.push({
        transactionType: "buy",
        transactionId: uuidv4(),
        date: new Date(),
        stocks: cart,
      });

      // send callback
      callback(null);
      break;
    }
  }

  console.log(database);
};

/**
 * Send back person given a username.
 * Add the current stock prices to their holdings.
 * @param {*} username
 * @param {*} callback (err, person)
 */
module.exports.getPerson = async (username, callback) => {
  // TODO: add currentPrice to the person.holdings elements using Yahoo Finance.
  let list = database.filter((person) => person.username == username);
  if (list.length == 1) {
    let person = list[0];

    for (let i = 0; i < person.holdings.length; i++) {
      try {
        person.holdings[i].currentPriceOfOneShare = await getQuote(
          person.holdings[i].ticker,
        );
      } catch (err) {
        console.log(err);
        person.holdings[i].currentPriceOfOneShare = 0;
      }
    }

    callback(null, person);
  } else {
    callback(true, null);
  }
};

/**
 * Add/subtract balance.
 * If the new balance will be negative, set it to zero.
 * @param {*} username
 * @param {*} addOrSubtract
 * @param {*} amount
 * @param {*} callback
 */
module.exports.addOrSubtractMoney = (
  username,
  addOrSubtract,
  amount,
  callback,
) => {
  let list = database.filter((person) => person.username == username);
  if (list.length == 1) {
    if (addOrSubtract == "subtract") {
      amount = -amount;
    }
    database = database.map((person) => {
      if (person.username == username) {
        let newBalance = person.money + amount;
        if (newBalance < 0) {
          newBalance = 0;
        }
        return {
          ...person,
          money: newBalance,
        };
      }
    });
    callback(null);
  } else {
    callback(true);
  }
};

function hash(text) {
  return crypto.createHash("sha512").update(text).digest("hex");
}

// callback (err, price)
// can be promises or callbacks
function getQuote(ticker, callback = null) {
  if (callback) {
    yahooFinance.quote(
      { symbol: ticker, modules: ["price"] },
      (err, quotes) => {
        let price = quotes.price.regularMarketPrice;
        if (err) {
          console.log(err);
          callback(err, null);
        } else {
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

/**
 * Function is started when the server starts up.
 * Goes through each person and checks if their limit or stop holdings are done.
 * If so, they sell the shares.
 */
module.exports.searchForLimitOrStopOrders = () => {
  let checkEvery = 1000 * 4; // check every 4 seconds
  setInterval(async () => {
    console.log("checking...");
    // go through all holdings of each person.
    for (let i = 0; i < database.length; i++) {
      for (let j = 0; j < database[i].holdings.length; j++) {
        const order = database[i].holdings[j];
        const currentPriceOfOneShare = await getQuote(order.ticker);
        if (order.limit) {
          // this is a limit order
          if (currentPriceOfOneShare >= order.limit) {
            // sell the stock
            this.completeSelling(
              database[i].username,
              [order.orderId],
              (err) => {
                if (err) {
                  console.log(err);
                  console.log("^^^Error in checking for limit order^^^");
                } else {
                  console.log("sold limit order!");
                }
              },
            );
          }
        } else if (order.stop) {
          // this is a stop order
          if (currentPriceOfOneShare <= order.stop) {
            // sell the stock
            this.completeSelling(
              database[i].username,
              [order.orderId],
              (err) => {
                if (err) {
                  console.log(err);
                  console.log("^^^Error in checking for stop order^^^");
                } else {
                  console.log("sold stop order!");
                }
              },
            );
          }
        }
      }
    }
  }, checkEvery);
};
