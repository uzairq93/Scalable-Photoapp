//
// app.get('/users', async (req, res) => {...});
//
// Return all the users from the database:
//
const dbConnection = require('./database.js')
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');

exports.get_users = async (req, res) => {

  console.log("call to /users...");

  try {
    //
    // build input object with request parameters:
    //
    var input = {
      Bucket: s3_bucket_name
    };

    //
    // calling S3 to get bucket status, returning a PROMISE
    // we have to wait on eventually:
    //
    console.log("/stats: calling S3...");

    var command = new HeadBucketCommand(input);
    var s3_response = s3.send(command);

    //
    // calling RDS to get # of users and # of assets. For
    // consistency, we turn the DB call with callback into
    // a PROMISE so we can wait for it while we wait for
    // the S3 response:
    //
    var rds_response = new Promise((resolve, reject) => {

      console.log("/users: calling RDS...");

      var sql = `
        SELECT * FROM users ORDER BY userid;
      `;

      dbConnection.query(sql, (err, results, _) => {
        if (err) {
          reject(err);
          return;
        }

        console.log("/users query done");

        // iterate through users to number objects in JSON
        var users = [];

        for (var i = 0; i < results.length; i++) {
          users.push({
            "userid": results[i].userid,
            "email": results[i].email,
            "lastname": results[i].lastname,
            "firstname": results[i].firstname,
            "bucketfolder": results[i].bucketfolder
          });
        }

        resolve(users);
      });
    });

    //
    // nothing else to do, so let's asynchronously wait
    // for the promises to resolve / reject:
    //
    Promise.all([s3_response, rds_response]).then(results => {

      var rds_results = results[1];

      //
      // done, respond with users:
      //
      console.log("/users done, sending response...");

      res.json({
        "message": "success",
        "data": rds_results,
      });

    });

  } //try
  catch (err) {
    res.status(400).json({
      "message": err.message,
      "data": []
    });
  }//catch

}//get
