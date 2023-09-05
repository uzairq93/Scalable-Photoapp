//
// app.get('/download/:assetid', async (req, res) => {...});
//
// downloads an asset from S3 bucket and sends it back to the
// client as a base64-encoded string.
//
const dbConnection = require('./database.js')
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');
const sharp = require('sharp');

exports.get_download = async (req, res) => {

  console.log("call to /download...");

  try {

    var assetid = parseInt(req.params.assetid);

    var rds_response = new Promise((res, rej) => {

      var sql = `SELECT * from assets where assetid = ?;`;

      dbConnection.query(sql, [assetid], (err, result, _) => {
        if (err) {
          rej(err);
          return;
        }

        res(result);
      });
    });

    var result = await rds_response;

    if (result.length == 0) {
      res.json({
        "message": "no such asset...",
        "user_id": -1,
        "asset_name": "?",
        "bucket_key": "?",
        "data": []
      });

      return;
    }

    var asset = result[0];

    var userid = asset["userid"];
    var assetname = asset["assetname"];
    var bucketkey = asset["bucketkey"];
    var input = {
      Bucket: s3_bucket_name,
      Key: bucketkey
    };

    var command = new GetObjectCommand(input);
    var s3_response = s3.send(command);

    var result = await s3_response;
    var buffer = Buffer.from(await new Promise((resolve, reject) => {
      const chunks = [];
      result.Body.on('data', chunk => chunks.push(chunk));
      result.Body.on('end', () => resolve(Buffer.concat(chunks)));
      result.Body.on('error', err => reject(err));
    }));
    var decompressedBuffer = await sharp(buffer).toBuffer();
    var datastr = decompressedBuffer.toString("base64");
  
    res.json({
      "message": "success",
      "user_id": userid,
      "asset_name": assetname,
      "bucket_key": bucketkey,
      "data": datastr
    });

  } catch (err) {
    res.status(400).json({
      "message": err.message,
      "user_id": -1,
      "asset_name": "?",
      "bucket_key": "?",
      "data": []
    });
  }
}
