# Photoapp

## Description
Implements a simple app for photo storage with a database of users using Node.js, Express, and Python.

This project enhanced Project 2 by adding the features suggested in the Final Project PDF: image meta-data extraction, search by meta-data, and image compression on upload to S3. 

For the image meta-data extraction, I extended the post_image function in api_image.js to extract metadata (camera make, capture date, and GPS coordinates) from an image uploaded to S3 using the exifr library. I also wrote a function to convert the GPS coordinates from DMS (degrees, minutes, and seconds) to decimal format, which is more compatible with the web service/more readable for users. The extracted metadata is inserted into the metadata table in the database, which was created using the SQL code in metadata.sql. 

I created another API function called api_metadata, which gets all the metadata from the database and prints it in a readable format. This aids users in using the search function, as all relevant metadata is easily accessed using this function.

To implement search by metadata, I created another function in api_image.js called search_image. This function receives the user ID, and some combination of camera make, date, location using the Google Geocoding API. It constructs a SQL query to search the metadata table based on the filters provided by the user. It filters images within a one-month range of the provided date, and within 50km of the provided provided coordinates (using ST_Distance_Sphere function).

I also added another feature to compress images using the sharp library before being uploaded to S3 (in api_image.js), and decompressing on download also using the sharp library.

For the client-side code, main.py was extended to include a new classs called Metadata, as well as two new commands (8, which calls api_metadata.js; 9, which calls search_image in api_image.js).
