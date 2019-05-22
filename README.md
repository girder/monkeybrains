monkeybrains
============

monkeybrains is a third-party, i.e. non-core, -plugin for Girder.

It has the following goals

  * demonstrate dataset visualization capabilities in Girder
  * target a specific Collection in Girder
  * live on a public Girder instance without intruding on other Collections

## Usage

Enable monkeybrains as a Girder plugin, then activate a specific Collection with the monkeybrains api call on a Collection, which you can do from Swagger.  This is intentionally hidden so that other Collections won't accidentally enable the functionality for them.

    PUT
    http://localhost:8082/api/v1/collection/550701fd0640fd09bf7d6f51/monkeybrains?monkeybrains=true

Once the `monkeybrains` property is added to your Collection, when you edit the collection, a new component will appear below `Description` allowing you to add a Markdown Info Page on your Collection.  This Info Page will be rendered as Markdown at the top of your Collection page within Girder, although any inline HTML in the Markup is sanitized.

A chart is also displayed on your Collection, showing a visualization of a longitudinal dataset.  This relies on an API call in the monkeybrains plugin called `getDatasetEvents`, which looks for Folders in the targeted Collection with a metadata key of `scan_date`, and returns the following set of metadata on those folders

  * _id
  * baseParentId
  * parentId
  * meta.folder_type
  * meta.scan_age
  * meta.sex
  * meta.scan_date
  * meta.subject_id
  * meta.dob
  * meta.scan_weight_kg

This metadata is used to create the longitudinal display and allow mouse click events on certain parts of the display to navigate to related Girder folders.

## Publishing

To publish a new version of this plugin:
* Increment the version in `setup.py`
* Run `tox -e release`
* Commit changes