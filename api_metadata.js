//
// app.get('/metadata', async (req, res) => {...});
//
// Return all the metadata from the database:
//
const dbConnection = require('./database.js')
const { HeadBucketCommand } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');


exports.get_metadata = async (req, res) => {

  console.log("call to /metadata...");

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

      console.log("/metadata: calling RDS...");

      const sqlSelectMetadata = `SELECT assetid, userid, assetname, cameramake, date, ST_AsText(location) as location FROM metadata`;

      dbConnection.query(sqlSelectMetadata, (err, results, _) => {
        if (err) {
          reject(err);
          return;
        }
      
        console.log("/metadata query done");

        // iterate through metadata to number objects in JSON
        var metadata = [];
      
        for (var i = 0; i < results.length; i++) {
          let aid = results[i].assetid;
          let uid = results[i].userid;
          let aname = results[i].assetname
          let cameraMake = results[i].cameramake
          let date = results[i].date ? results[i].date.toISOString().split('T')[0] : "Date info not in image metadata";
          let loc = results[i].location ? results[i].location.toString() : "Location info not in image metadata";
          
          metadata.push({
            "assetid": aid,
            "userid": uid,
            "assetname": aname,
            "cameramake": cameraMake,
            "date": date,
            "location": loc,
          });
        }

        resolve(metadata);
      });
    });

    //
    // nothing else to do, so let's asynchronously wait
    // for the promises to resolve / reject:
    //
    Promise.all([s3_response, rds_response]).then(results => {
      var rds_results = results[1];

      //
      // done, respond with metadata:
      //
      console.log("/metadata done, sending response...");

      res.json({
        "message": "success",
        "data": rds_results,
      });

    });

  } catch (err) {
    res.status(400).json({
      "message": err.message,
      "data": []
    });
  }
}

