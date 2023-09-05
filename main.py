#
# Client-side python app for photoapp, this time working with
# web service, which in turn uses AWS S3 and RDS to implement
# a simple photo application for photo storage and viewing.
#
# Final Project for CS 310, Spring 2023.
#


import requests  # calling web service
import jsons  # relational-object mapping

import uuid
import pathlib
import logging
import sys
import os
import base64

from configparser import ConfigParser
from datetime import date
from datetime import datetime

import matplotlib.pyplot as plt
import matplotlib.image as img


###################################################################
#
# classes
#
class User:
  userid: int  # these must match columns from DB table
  email: str
  lastname: str
  firstname: str
  bucketfolder: str


class Asset:
  assetid: int  # these must match columns from DB table
  userid: int
  assetname: str
  bucketkey: str


class BucketItem:
  Key: str  # these must match columns from DB table
  LastModified: str
  ETag: str
  Size: int
  StorageClass: str


class Metadata:
  assetid: int
  userid: int
  assetname: str
  cameramake: str
  date: date
  location: str


###################################################################
#
# prompt
#
def prompt():
  """
  Prompts the user and returns the command number
  
  Parameters
  ----------
  None
  
  Returns
  -------
  Command number entered by user (0, 1, 2, ...)
  """
  print()
  print(">> Enter a command:")
  print("   0 => end")
  print("   1 => stats")
  print("   2 => users")
  print("   3 => assets")
  print("   4 => download")
  print("   5 => download and display")
  print("   6 => bucket contents")
  print("   7 => upload image")
  print("   8 => metadata")
  print("   9 => search image")

  cmd = int(input())
  return cmd


###################################################################
#
# stats
#
def stats(baseurl):
  """
  Prints out S3 and RDS info: bucket status, # of users and 
  assets in the database
  
  Parameters
  ----------
  baseurl: baseurl for web service
  
  Returns
  -------
  nothing
  """

  try:
    #
    # call the web service:
    #
    api = '/stats'
    url = baseurl + api

    res = requests.get(url)
    #
    # let's look at what we got back:
    #
    if res.status_code != 200:
      # failed:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:  # we'll have an error message
        body = res.json()
        print("Error message:", body["message"])
      #
      return

    #
    # deserialize and extract stats:
    #
    body = res.json()
    #
    print("bucket status:", body["message"])
    print("# of users:", body["db_numUsers"])
    print("# of assets:", body["db_numAssets"])

  except Exception as e:
    logging.error("stats() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


###################################################################
#
# users
#
def users(baseurl):
  """
  Prints out all the users in the database
  
  Parameters
  ----------
  baseurl: baseurl for web service
  
  Returns
  -------
  nothing
  """

  try:
    #
    # call the web service:
    #
    api = '/users'
    url = baseurl + api

    res = requests.get(url)

    #
    # let's look at what we got back:
    #
    if res.status_code != 200:
      # failed:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:  # we'll have an error message
        body = res.json()
        print("Error message:", body["message"])
      #
      return

    #
    # deserialize and extract users:
    #
    body = res.json()
    #
    # let's map each dictionary into a User object:
    #
    users = []
    for row in body["data"]:
      user = jsons.load(row, User)
      users.append(user)
    #
    # Now we can think OOP:
    #
    for user in users:
      print(user.userid)
      print(" ", user.email)
      print(" ", user.lastname, ",", user.firstname)
      print(" ", user.bucketfolder)

  except Exception as e:
    logging.error("users() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


###################################################################
#
# assets
#
def assets(baseurl):
  """
  Prints out all the assets in the database
  
  Parameters
  ----------
  baseurl: baseurl for web service
  
  Returns
  -------
  nothing
  """

  try:
    #
    # call the web service:
    #
    api = '/assets'
    url = baseurl + api

    res = requests.get(url)

    #
    # let's look at what we got back:
    #
    if res.status_code != 200:
      # failed:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:  # we'll have an error message
        body = res.json()
        print("Error message:", body["message"])
      #
      return

    #
    # deserialize and extract assets:
    #
    body = res.json()
    #
    # let's map each dictionary into a Asset object:
    #
    assets = []
    for row in body["data"]:
      asset = jsons.load(row, Asset)
      assets.append(asset)

    for asset in assets:
      print(asset.assetid)
      print(" ", asset.userid)
      print(" ", asset.assetname)
      print(" ", asset.bucketkey)

  except Exception as e:
    logging.error("assets() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


###################################################################
#
# download
#
def download(baseurl, display=False):
  """
    Downloads an asset from the web service using its ID and writes it to the file system.
    
    Parameters
    ----------
    baseurl: baseurl for web service
    
    Returns
    -------
    nothing
    """

  try:
    asset_id = input("Enter asset id>\n")

    api = '/download/' + asset_id
    url = baseurl + api

    res = requests.get(url)

    # not successful
    if res.status_code != 200:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:
        body = res.json()
        print("Error message:", body["message"])
      return

    body = res.json()
    if body["message"] == "no such asset...":
      print("No such asset...")
      return

    userid = body["user_id"]
    asset_name = body["asset_name"]
    bucket_key = body["bucket_key"]
    data = body["data"]
    decoded_bytes = base64.b64decode(data)

    outfile = open(asset_name, "wb")
    outfile.write(decoded_bytes)
    outfile.close()

    print("userid:", userid)
    print("asset name:", asset_name)
    print("bucket key:", bucket_key)
    print("Downloaded from S3 and saved as '", asset_name, "'")

    if display:
      image = img.imread(asset_name)
      plt.imshow(image)
      plt.show()

  except Exception as e:
    logging.error("download() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


###################################################################
#
# bucket contents
#
def bucket_contents(baseurl):
  """
    Calls the web service API function /bucket and displays information about 
    each bucket asset returned in the response.
    
    Parameters
    ----------
    baseurl: baseurl for web service
    
    Returns
    -------
    nothing
    """

  try:
    api = '/bucket'
    url = baseurl + api
    startafter = ''

    while True:
      param = {'startafter': startafter}
      res = requests.get(url, param)

      if res.status_code != 200:
        print("Failed with status code:", res.status_code)
        print("url: " + url)
        if res.status_code == 400:
          body = res.json()
          print("Error message:", body["message"])
        return

      body = res.json()

      if len(body['data']) == 0:
        break

      for row in body['data']:
        print(row['Key'])
        print(" ", row['LastModified'])
        print(" ", row['Size'])

      last_page = body['data'][-1]
      startafter = last_page['Key']

      nextpage = input("another page? [y/n]\n")
      if nextpage != 'y':
        break

  except Exception as e:
    logging.error("bucket() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


####################################################################
#
# image
#
def image(baseurl):
  """
    Uploads an image to S3 and updates the database accordingly
    
    Parameters
    ----------
    baseurl: baseurl for web service
    
    Returns
    -------
    nothing
    """
  try:
    user_id = input("Enter user id>\n")
    image_filename = input("Enter image filename>\n")

    with open(image_filename, "rb") as image_file:
      encoded_string = base64.b64encode(image_file.read()).decode('utf-8')

    payload = {"assetname": image_filename, "data": encoded_string}

    api = '/image/' + user_id
    url = baseurl + api

    res = requests.post(url, json=payload)

    if res.status_code != 200:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:
        body = res.json()
        print("Error message:", body["message"])
      return

    body = res.json()
    if body["message"] == "no such user...":
      print("No such user...")
      return

    asset_id = body["assetid"]
    print("Asset id:", asset_id)
    print("Image uploaded successfully.")

  except Exception as e:
    print("upload() failed:")
    print("url: " + url)
    print(e)
    return


####################################################################
#
# metadata
#
def metadata(baseurl):
  """
  Prints out all the metadata in the database
  
  Parameters
  ----------
  baseurl: baseurl for web service
  
  Returns
  -------
  nothing
  """

  try:
    #
    # call the web service:
    #
    api = '/metadata'
    url = baseurl + api

    res = requests.get(url)

    #
    # let's look at what we got back:
    #
    if res.status_code != 200:
      # failed:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:
        body = res.json()
        print("Error message:", body["message"])
      #
      return

    #
    # deserialize and extract metadata:
    #
    body = res.json()
    #
    # let's map each dictionary into a Metadata object:
    #

    metadata_list = []
    for row in body["data"]:
      metadata = jsons.load(row, Metadata)
      metadata_list.append(metadata)

    for metadata in metadata_list:
      location = metadata.location
      if location and "POINT" in location:
        coords = location.split("(")[1].split(")")[0].split()
        latitude = coords[0]
        longitude = coords[1]
      else:
        latitude = "Location info not in image metadata"
        longitude = "Location info not in image metadata"

      print(metadata.assetid)
      print("  User ID:", metadata.userid)
      print("  Asset Name:", metadata.assetname)
      print("  Camera Make:", metadata.cameramake)
      print("  Date:", metadata.date)
      print("  Latitude:", latitude)
      print("  Longitude:", longitude)

  except Exception as e:
    logging.error("metadata() failed:")
    logging.error("url: " + url)
    logging.error(e)
    return


####################################################################
#
# search_image


def search_image(baseurl):
  """
  Search an image based on the date or location or both
  
  Parameters
  ----------
  baseurl: baseurl for web service
  
  Returns
  -------
  Image metadata
  """

  try:
    user_id = input("Enter user id>\n")

    make = input(
      "Enter camera make (e.g. Apple, Canon, etc.), or press enter to skip>\n")
    date = input("Enter date in yyyy-mm-dd format, or press enter to skip>\n")
    location = input(
      "Enter an address as such: 123 Main Street, City, Country or a partial address: City, Country or press enter to skip>\n"
    )

    params = {}
    if make:
      try:
        make = make.lower().replace(" ", "")
        params['make'] = make
      except ValueError:
        print("Invalid make input")
        return

    if date:
      try:
        #
        # Validating date format
        #
        datetime.strptime(date, '%Y-%m-%d')
        params['date'] = date
      except ValueError:
        print("Invalid date format. Must be yyyy-mm-dd format.")
        return

    if location:
      params['address'] = location

    #
    # call the web service:
    #
    api = f'/search_image/{user_id}'
    url = baseurl + api

    res = requests.get(url, params=params)

    #
    # let's look at what we got back:
    #
    # failed
    if res.status_code != 200:
      print("Failed with status code:", res.status_code)
      print("url: " + url)
      if res.status_code == 400:
        body = res.json()
        if body.get("message") == "no such user...":
          print("No such user...")
        else:
          print("Error message:", body["message"])
      return

    #
    # deserialize and extract metadata:
    #
    body = res.json()

    # No image meets filter criteria
    if not body["data"]:
      print("No image found.")
      return

    # Store metadata cols as variables, print
    for row in body["data"]:
      assetid = row['assetid']
      userid = row['userid']
      assetname = row['assetname']
      camera_make = row['cameramake']
      date = row['date']
      date_stripped = date.split("T")[0]
      location = (row.get('location'))

      # Handle case in which image does not have location information in metadata
      if location is not None:
        latitude = location['x']
        longitude = location['y']
      else:
        latitude = "Location info not in image metadata"
        longitude = "Location info not in image metadata"

      # print metadata for image
      print(assetid)
      print("  User ID:", userid)
      print("  Asset Name:", assetname)
      print("  Make:", camera_make)
      print("  Date:", date_stripped)
      print("  Latitude:", latitude)
      print("  Longitude:", longitude)

  except Exception as e:
    print("search_image() failed:")
    print("url: " + url)
    print(e)
    return


#########################################################################
# main
#
print('** Welcome to PhotoApp v2 **')
print()

# eliminate traceback so we just get error message:
sys.tracebacklimit = 0

#
# what config file should we use for this session?
#
config_file = 'photoapp-client-config'

print("What config file to use for this session?")
print("Press ENTER to use default (photoapp-config),")
print("otherwise enter name of config file>")
s = input()

if s == "":  # use default
  pass  # already set
else:
  config_file = s

#
# does config file exist?
#
if not pathlib.Path(config_file).is_file():
  print("**ERROR: config file '", config_file, "' does not exist, exiting")
  sys.exit(0)

#
# setup base URL to web service:
#
configur = ConfigParser()
configur.read(config_file)
baseurl = configur.get('client', 'webservice')

# print(baseurl)

#
# main processing loop:
#
cmd = prompt()

while cmd != 0:
  #
  if cmd == 1:
    stats(baseurl)
  elif cmd == 2:
    users(baseurl)
  elif cmd == 3:
    assets(baseurl)
  elif cmd == 4:
    download(baseurl, display=False)
  elif cmd == 5:
    download(baseurl, display=True)
  elif cmd == 6:
    bucket_contents(baseurl)
  elif cmd == 7:
    image(baseurl)
  elif cmd == 8:
    metadata(baseurl)
  elif cmd == 9:
    search_image(baseurl)
  else:
    print("** Unknown command, try again...")
  #
  cmd = prompt()

#
# done
#
print()
print('** done **')
