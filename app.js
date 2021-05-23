let express = require("express");
let app = express();
let eta = require("eta");
const router = require("./router");
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 8000;
const mongoose = require("mongoose");

const env = process.env.NODE_ENV || null;
const DB_NAME = "stocks";
const localDatabaseURL = `mongodb://127.0.0.1:27017/${DB_NAME}`;
const productionDatabaseURL = `...`; // TODO

mongoose
  .connect(env ? productionDatabaseURL : localDatabaseURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Mongoose Connected..."))
  .catch((err) => console.log(err));

// TODO: just send whole Person object to the eta file.
// TODO: Also, make middleware that checks if person is logged in and if not, sends them back to the homepage with the alert banner: Please log in before continuing.
// TODO: IN COOKIES: a person's cart is just a comma separated list of stocks they put in their cart (eg. "vti,brk-a,mstr")

app.engine("eta", eta.renderFile);
app.set("view engine", "eta");
app.set("views", "./views");

app.use(express.static("public"));

app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies
app.use(cookieParser());

app.use(router);

app.listen(PORT, function () {
  console.log(`listening to requests on port ${PORT}`);
});
