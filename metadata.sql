-- SQL used to create metadata table

CREATE TABLE metadata (
  assetid INT PRIMARY KEY,
  userid INT,
  assetname VARCHAR(128),
  cameramake VARCHAR(128),
  date DATE,
  location POINT
);