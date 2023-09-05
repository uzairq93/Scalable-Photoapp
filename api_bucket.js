//
// app.get('/bucket?startafter=bucketkey', async (req, res) => {...});
//
// Retrieves the contents of the S3 bucket and returns the 
// information about each asset to the client. Note that it
// returns 12 at a time, use startafter query parameter to pass
// the last bucketkey and get the next set of 12, and so on.
//
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');

exports.get_bucket = async (req, res) => {

  console.log("call to /bucket...");

  try {

    let startAfter = req.query.startafter || '';

    //
    // build input object with request parameters:
    //

    var input = {
      Bucket: s3_bucket_name,
      MaxKeys: 12,
      StartAfter: startAfter
    };

    //
    // calling ListObjectsV2Command
    //

    var command = new ListObjectsV2Command(input)
    var s3_response = await s3.send(command);

    // return empty list when Contents does not exist
    if (!s3_response.Contents) {
      res.json({
        "message": "success",
        "data": []
      });
      return;
    }

    var bucket = [];
    var len_s3 = s3_response.Contents.length

    // iterate through to number objects in data

    for (var i = 0; i < len_s3; i++) {
      bucket.push({
        "Key": s3_response.Contents[i].Key,
        "LastModified": s3_response.Contents[i].LastModified,
        "ETag": s3_response.Contents[i].ETag,
        "Size": s3_response.Contents[i].Size,
        "StorageClass": s3_response.Contents[i].StorageClass
      });
    }

    res.json({
      "message": "success",
      "data": bucket
    });

  }//try
  catch (err) {
    res.status(400).json({
      "message": err.message,
      "data": []
    });
  } //catch
}
