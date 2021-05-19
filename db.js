var crypto = require("crypto");

// database for now.
// TODO: add mongo
let database = [];

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
    database.push({ username, password: hashedPassword });
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
 *
 * @param {*} username
 * @param {*} callback (err, person)
 */
module.exports.getPerson = (username, callback) => {
  let list = database.filter((person) => person.username == username);
  if (list.length == 1) {
    let person = list[0];
    callback(null, person);
  } else {
    callback(true, null);
  }
};

function hash(text) {
  return crypto.createHash("sha512").update(text).digest("hex");
}
