var crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const yahooFinance = require("yahoo-finance");

// database for now.
// TODO: add mongo
let database = [
  {
    username: "zach",
    // 123
    password:
      "3c9909afec25354d551dae21590bb26e38d53f2173b8d3dc3eee4c047e7ab1c1eb8b85103e3be7ba613b31bb5c9c36214dc9f14a42fd7a2fdb84856bca5c44c2",
    historyOfMoney: [],
    money: 0,
    transactions: [
      {
        transactionType: "buy",
        transactionId: uuidv4(),
        stocks: [
          {
            pricePerShare: 127.31,
            ticker: "aapl",
            quantity: 1,
            date: new Date(),
          },
        ],
      },
    ],
    holdings: [
      {
        orderId: uuidv4(),
        ticker: "aapl",
        quantity: 1,
        date: new Date(),
        limit: 130,
      },
    ],
  },
];
/**
 * Person in Database:
{
  username,
  password,
  // history of adding/taking away money from the account
  historyOfMoney: [
    {
      date: 2893467882,
      moneyAdded: -23984 // positive or negative number for how much added/subtracted
    }
  ]
  money: 128374.38,
  netWorth: [{date: 8273874, worth: 173872}, {date: 923843, worth: 1829387}] // updated periodically
  transactions: [
    {
      transactionType: "buy" | "sell",
      transactionId: "UUID",
      stocks: [
        {
          pricePerShare: 3829.32,
          ticker: "VTI",
          quantity: 4,
          date: 38298473
        }
      ]
    }
  ],
  holdings: [
    {
      orderId: "UUID",
      ticker: "VTI", 
      quantity: 4
    },
    {
      orderId: "UUID",
      ticker: "aapl",
      quantity: 5,
      limit: 249.43
    },
    {
      orderId: "UUID",
      ticker: "brk-a",
      quantity: 2,
      stop: 200000
    }
  ]
}
 */

/**
 * Creates a new person in the database.
 * @param {*} username
 * @param {*} password
 * @param {*} callback
 */
module.exports.createPerson = (username, password, callback) => {
  // check if person exists
  if (database.filter((person) => person.username == username).length > 0) {
    callback(true); // error
  } else {
    // create person
    let hashedPassword = hash(password);
    let newPerson = {
      username,
      password: hashedPassword,
      money: 0,
      historyOfMoney: [],
      transactions: [],
      holdings: [],
    };
    database.push(newPerson);
    // console.log(database);
    callback(null); // no error
  }
};

/**
 * Is the username/password combo correct.
 * @param {*} username
 * @param {*} password
 * @param {*} callback (err, isCorrect: boolean)
 */
module.exports.passwordIsCorrect = (username, password, callback) => {
  // check if username exists and password is right
  if (
    database.filter((person) => person.username == username).length == 1 &&
    database.filter((person) => person.username == username)[0].password ==
      hash(password)
  ) {
    callback(null, true);
  } else {
    callback(null, false);
  }
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
