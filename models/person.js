const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { v4: uuidv4 } = require("uuid");

let Stock = {
  ticker: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    min: 1,
    required: true,
  },
  date: {
    type: Date,
    default: new Date(),
  },
};

let Person = new Schema({
  username: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  historyOfMoney: {
    type: [Object],
    default: [],
    required: true,
  },
  money: {
    type: Number,
    default: 0,
    min: 0,
    required: true,
  },
  transactions: {
    default: [],
    type: [
      {
        transactionType: {
          type: String, // "buy" or "sell"
          required: true,
        },
        transactionId: {
          type: String,
          required: true,
          default: uuidv4(),
        },
        stocks: {
          type: [Stock],
        },
      },
    ],
  },
  holdings: {
    defualt: [],
    type: [
      {
        orderId: {
          type: String,
          required: true,
          default: uuidv4(),
        },
        ticker: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          min: 1,
          required: true,
        },
        date: {
          type: Date,
          required: true,
          default: new Date(),
        },
        limit: {
          type: Number,
        },
        stop: {
          type: Number,
        },
      },
    ],
  },
});

module.exports = mongoose.model("Person", Person);
