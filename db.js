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
  Person.findOne({ username }, (err, doc) => {
    if (err) {
      callback(err, null);
    } else {
      if (!doc) {
        callback(err, null);
      } else {
        let passwordCorrect = doc.password;
        if (hash(password) == passwordCorrect) {
          callback(null, true);
        } else {
          callback(null, false);
        }
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
  if (!listOfSellingOrderIds || !(listOfSellingOrderIds.length >= 1)) {
    callback("ERROR: No selling options selected.");
    return;
  }

  Person.findOne({ username }, async (err, doc) => {
    if (err) {
      console.log(err);
      callback(err);
    } else {
      let { totalSellingPrice, holdingsToSell } = await getTotalSellingPrice(
        doc.holdings,
        listOfSellingOrderIds,
      );

      let newMoney = doc.money + totalSellingPrice;

      // update money and transactions
      Person.updateOne(
        { username },
        {
          money: newMoney,
          $push: {
            transactions: { transactionType: "sell", stocks: holdingsToSell },
          },
        },
        (err, affected, resp) => {
          if (err) {
            console.log(err);
            callback(err);
          } else {
            // remove holdings
            Person.updateOne(
              { username },
              {
                $pull: {
                  holdings: { orderId: { $in: listOfSellingOrderIds } },
                },
              },
              (err, doc) => {
                if (err) {
                  console.log(err);
                  callback(err);
                } else {
                  callback(null);
                }
              },
            );
          }
        },
      );
    }
  });
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
  Person.updateOne(
    { username },
    {
      $inc: { money: -totalPrice },
      $addToSet: { holdings: { $each: cart } },
      $push: { transactions: { transactionType: "buy", stocks: cart } },
    },
    (err, doc) => {
      if (err) {
        console.log(err);
        callback(err);
      } else {
        callback(null);
      }
    },
  );
};

/**
 * Send back person given a username.
 * Add the current stock prices to their holdings.
 * @param {*} username
 * @param {*} callback (err, person)
 */
module.exports.getPerson = (username, callback) => {
  Person.findOne({ username }, async (err, doc) => {
    if (err) {
      callback(err, null);
    } else {
      let person = doc;

      // set current prices
      for (let i = 0; i < person.holdings.length; i++) {
        try {
          person.holdings[i].currentPriceOfOneShare = (
            await getQuote(person.holdings[i].ticker)
          ).toFixed(2);
        } catch (err) {
          console.log(err);
          person.holdings[i].currentPriceOfOneShare = 0;
        }
      }
      callback(null, person);
    }
  });
};

/**
 * Add/subtract balance.
 * If the new balance will be negative, set it to zero.
 * @param {*} username
 * @param {*} addOrSubtract
 * @param {*} amount
 * @param {*} callback(err)
 */
module.exports.addOrSubtractMoney = (
  username,
  addOrSubtract,
  amount,
  callback,
) => {
  // set amount to negative if subtracting
  if (addOrSubtract == "subtract") {
    amount = -amount;
  }

  Person.updateOne(
    { username },
    {
      $inc: { money: amount },
    },
    (err, doc) => {
      if (err) {
        callback(err);
      } else {
        callback(null);
      }
    },
  );
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
    Person.find({}, async (err, docs) => {
      if (err) {
        console.log(err);
        return;
      }

      // TODO: fix this crude way of doing it.
      let database = docs;

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
    });
  }, checkEvery);
};

async function getTotalSellingPrice(holdings, listOfSellingOrderIds) {
  // get total price
  let holdingsToSell = holdings.filter((order) =>
    listOfSellingOrderIds.includes(order.orderId),
  );

  // get current prices
  for (let j = 0; j < holdingsToSell.length; j++) {
    holdingsToSell[j].currentPriceOfOneShare = await getQuote(
      holdingsToSell[j].ticker,
    );
  }

  // console.log("---------------\nHoldings to sell\n\n\n");
  // console.log(holdingsToSell);
  // console.log("---------------\nHoldings to sell\n\n\n");

  // set total price
  let totalSellingPrice = 0;
  holdingsToSell.map((order) => {
    totalSellingPrice += order.currentPriceOfOneShare * order.quantity;
    return "";
  });

  return { totalSellingPrice, holdingsToSell };
}
