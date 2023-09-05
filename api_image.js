// app.post('/image/:userid', async (req, res) => {...});
//
// Uploads an image to the bucket and updates the database,
// returning the asset id assigned to this image.
//

//app.get('/search_image/:userid', (req, res) => {...});

// Searches a user's folder for photos near a given date,
// and/or near a given location (latitude, longitude) (in Decimal)

const dbConnection = require('./database.js')
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { s3, s3_bucket_name, s3_region_name } = require('./aws.js');
const uuid = require('uuid');
const exifr = require('exifr');
const sharp = require('sharp'); // Node.js library to compress image on upload
const config = require('./config.js'); //need the geocoding API key
const fetch = require('node-fetch');

exports.post_image = async (req, res) => {
  console.log("call to /image...");

  // check if user exists in the database
  try {
    var data = req.body;  // data => JS object
    const userid = parseInt(req.params.userid);
    const sqlSelect = `SELECT * FROM users WHERE userid = ?`;

    dbConnection.query(sqlSelect, [userid], async (err, resultUser) => {
      if (err) {
        res.status(400).json({
          "message": err.message,
          "assetid": -1
        });
        return;
      }

      // If user does not exist, return error
      if (resultUser.length == 0) {
        res.status(200).json({
          "message": "no such user...",
          "assetid": -1
        });
        return;
      }

      // User exists, image is uploaded to S3, stored in user's folder with unique bucket key
      const bucketfolder = resultUser[0].bucketfolder;
      var name = uuid.v4();
      var key = name + '.jpg';
      key = bucketfolder + "/" + key;

      var S = req.body.data;
      var bytes = Buffer.from(S, 'base64');

      // Compress image before upload using sharp (save space and $ with S3)
      var compBytes = await sharp(bytes)
        .jpeg({ quality: 50 })  // Quality, can adjust this
        .toBuffer();
      

      const params = {
        Bucket: s3_bucket_name,
        Key: key,
        Body: compBytes
      };

      const command = new PutObjectCommand(params);
      const result = await s3.send(command);

      // extract metadata
      let metadata = await exifr.parse(bytes);

      // Function to convert DMS coordinates to Decimal
      // Would make Google Geocoding API easier (input needs to be in decimal)
      // Even if we dont use the API, this format is more readable I think
      function dmsToDecimal([degrees, minutes, seconds]) {
        decimalCoords = degrees + minutes / 60 + seconds / 3600;
        return decimalCoords;
      }

      // Extract metadata (cameramake, date, latitude, longitude)
      // We can add more to this if we want
    
      let date = null;
      let location = null;
      let cameraMake = null;
      let latitude, longitude;

      if (metadata) {
        if (metadata.Make) {
          cameraMake = metadata.Make;
        }
        if (metadata.DateTimeOriginal || metadata.CreateDate) {
          date = metadata.DateTimeOriginal || metadata.CreateDate;
        }

        if (metadata.GPSLatitude && metadata.GPSLongitude) {
          latitude = dmsToDecimal(metadata.GPSLatitude);
          longitude = dmsToDecimal(metadata.GPSLongitude);
          location = `POINT(${latitude} ${-longitude})`;
        }

        // Insert image into assets table
        const sqlInsert = `INSERT INTO assets (userid, assetname, bucketkey) VALUES (?, ?, ?)`;
        dbConnection.query(sqlInsert, [userid, data.assetname, key], (err, resultInsert) => {
          if (err || resultInsert.affectedRows !== 1) {
            res.status(400).json({
              "message": "Asset insertion failed",
              "assetid": -1
            });
            return;
          }

          // Insert image into metadata table
          const sqlInsertMetadata = `INSERT INTO metadata (assetid, userid, assetname, cameramake, date, location) VALUES (?, ?, ?, ?, ?, ST_PointFromText(?))`;
          dbConnection.query(sqlInsertMetadata, [resultInsert.insertId, userid, data.assetname, cameraMake, date, location], (err, resultMetadata) => {
            if (err || resultMetadata.affectedRows !== 1) {
              res.status(400).json({
                "message": "Metadata insertion failed",
                "assetid": -1
              });
              return;
            }

            res.json({
              "message": "success",
              "assetid": resultInsert.insertId
            });
          });
        });
      } else {
        res.status(400).json({
            "message": "Metadata extraction failed",
        });
        return;
      }
    });
  } catch (err) {
    res.status(400).json({
      "message": err.message,
      "assetid": -1
    });
  }
}

exports.search_image = async (req, res) => {
  console.log("call to /search_image...");

  try {
    // get the parameters from the client request
    var userid = req.params.userid;
    var make = req.query.make;
    var date = req.query.date;
    var lat = req.query.lat;
    var lon = req.query.lon;
    var address = req.query.address;
    const sqlSelect = `SELECT * FROM users WHERE userid = ?`;
    
    dbConnection.query(sqlSelect, [userid], async (err, resultUser) => {
      if (err) {
        res.status(400).json({
          "message": err.message,
          "data": []
        });
        return;
      }

      if (resultUser.length == 0) {
        res.status(200).json({
          "message": "no such user...",
          "data": []
        });
        return;
      }

      // Search metadata table using user id
      var searchQuery = `SELECT * FROM metadata WHERE userid = ?`;
      var searchParams = [userid];

      // Filter by camera make (e.g. Apple, Canon, etc.), if provided by user
      if (make) {
        searchQuery += " AND cameramake = ?";
        searchParams.push(make);
      }

      // Filter by date (within a month), if provided by user
      if (date) {
        searchQuery += " AND date BETWEEN DATE(?) - INTERVAL 1 MONTH AND DATE(?) + INTERVAL 1 MONTH";
        searchParams.push(date, date);
      }

      // Filter by coordinates, if provided by user
      // ST_Distance_Sphere computes dist between image location and provided location
      // Range currently set to 50000 (50 km)
      if (address) {
        try {
          const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${config.google_maps_api_key}`);
          const data = await response.json();
          console.log("data = ", data);
          console.log("lat, lon = ", data.results[0].geometry.location)
          const location = data.results[0].geometry.location;
          lat = location.lat;
          lon = location.lng;
          searchQuery += " AND ST_Distance_Sphere(location, ST_PointFromText(?)) <= 50000";
        searchParams.push(`POINT(${lat} ${lon})`);
        } catch (error) {
          console.error('Error fetching coordinates from Google Geocoding API:', error.message);
        }
      }
      if (lat && lon) {
        searchQuery += " AND ST_Distance_Sphere(location, ST_PointFromText(?)) <= 50000";
        searchParams.push(`POINT(${lat} ${lon})`);
      }

      dbConnection.query(searchQuery, searchParams, (err, results) => {
        if (err) {
          res.status(400).json({
            "message": err.message,
            "data": []
          });
          return;
        }

        if (results.length == 0) {
          res.json({
            "message": "No images found...",
            "data": results
          });
        } else {
          res.json({
            "message": "success",
            "data": results
          });
        }
      });

    });

  } catch (err) {
    res.status(400).json({
      "message": err.message,
      "data": []
    });
  }

}