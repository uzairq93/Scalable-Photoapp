
//
// app.get('/assets', async (req, res) => {...});
//
// Return all the assets from the database:
//
const dbConnection = require('./database.js')
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');


exports.get_assets = async (req, res) => {

  console.log("call to /assets...");

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
    
  var rds_response = new Promise((resolve, reject) => {

    console.log("/assets: calling RDS...");

    var sql = `
    SELECT * FROM assets ORDER BY assetid;
    `;

    dbConnection.query(sql, (err, results, _) => {
      if (err) {
        reject(err);
        return;
      }

      console.log("/assets query done");

      // iterate through assets to number objects in JSON
      var assets = [];
      
      for (var i = 0; i < results.length; i++) {
        assets.push({
          "assetid": results[i].assetid,
          "userid": results[i].userid,
          "assetname": results[i].assetname,
          "bucketkey": results[i].bucketkey,
        });
      }

      resolve(assets);
    });
  });

  //
  // nothing else to do, so let's asynchronously wait
  // for the promises to resolve / reject:
  //
  Promise.all([s3_response, rds_response]).then(results => {

    var rds_results = results[1];

    //
    // done, respond with assets:
    //
    console.log("/assets done, sending response...");

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

