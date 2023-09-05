//
// app.put('/user', async (req, res) => {...});
//
// Inserts a new user into the database, or if the
// user already exists (based on email) then the
// user's data is updated (name and bucket folder).
// Returns the user's userid in the database.
//
const dbConnection = require('./database.js');

exports.put_user = (req, res) => {

  console.log("call to /user...");

  try {

    var data = req.body;  // data => JS object
    console.log(data);

    var sqlSelect = `SELECT * FROM users WHERE email = ?`;
    dbConnection.query(sqlSelect, [data.email], (err, resultsSelect) => {

      if (err) {
        res.status(400).json({
          "message": err.message,
          "userid": -1
        });
        return;
      }
      // If user exists, update DB
      if (resultsSelect.length > 0) {
        var sqlUpdate = `UPDATE users SET lastname = ?, firstname = ?, bucketfolder = ? WHERE email = ?`;

        dbConnection.query(sqlUpdate, [data.lastname, data.firstname, data.bucketfolder, data.email], (err, resultsUpdate) => {

          // Return error message if DB failed to update
          if (resultsUpdate.affectedRows != 1) {
            res.json({
              "message": "Update failed",
              "userid": -1
            });
            return;
          }

          // Update successful
          uID = resultsSelect[0].userid
          res.json({
            "message": "updated",
            "userid": uID
          });
        });

      } else {  // If user doesn't exist, insert new user
        const sqlInsert = `INSERT INTO users (email, lastname, firstname, bucketfolder) VALUES (?, ?, ?, ?)`;

        dbConnection.query(sqlInsert, [data.email, data.lastname, data.firstname, data.bucketfolder], (err, resultInsert) => {
          if (err) {
            res.status(400).json({
              "message": err.message,
              "userid": -1
            });
            return;
          }
          if (resultInsert.affectedRows != 1) {
            res.json({
              "message": "User insertion failed",
              "userid": -1
            });
            return;
          }
          user_id = resultInsert.insertId
          res.json({
            "message": "inserted",
            "userid": user_id
          });
        });
      }
    });

  } catch (err) {
    res.status(400).json({
      "message": err.message,
      "userid": -1
    });
  }

}
