#!/usr/bin/env python

"""
utility script used to set metadata on a collection after an upload.  Expects metadata in json format
as in the adjoining metadata.json file.  The format for an individual subject looks like the following,
and dates should be formatted as YYYY-MM-DD.

"023": {
    "DOB": "2013-01-04",
    "scans": [
        ["02months", "2013-02-27", 0.716],
        ["05months", "2013-06-06", 1.15],
        ["08months", "2013-08-28", 1.64],
        ["11months", "2013-11-20", 1.85],
        ["14months", "2014-03-12", 2.24]],
    "subject": "023",
    "sex": "F"}

This also expects to some degree that the folder structure is consistent with what is here:

https://data.kitware.com/#collection/54b582c38d777f4362aa9cb3/folder/54b582d88d777f4362aa9cb5

which is

subject_id (e.g. 001)
    scantime (e.g. 12months)
        DTI
            AUTOQC
            ORIG
        sMRI
            ORIG
            Reg2Atlas
                AUTO_MASK

data upload can be done by the girder python client cli.
"""

import re
import girder_client

username = ''
password = ''
parent_id = '550702610640fd09bf7d6f53'
host = 'localhost'
port = 8080
metadata_file = '/home/vagrant/metadata/metadata.json'


username = ''
password = ''
parent_id = '54b582d88d777f4362aa9cb5'
port = 443
scheme = 'https'
host = 'data.kitware.com'

def load_metadata(metadata_file):
    import json
    with open(metadata_file) as json_file:
        json_data = json.load(json_file)
    return json_data

metadata = load_metadata(metadata_file)
g = girder_client.GirderClient(host, port, scheme=scheme)
g.authenticate(username, password)

subject_regex = re.compile(r'^(\d\d\d)$')
subject_scan_age_regex = re.compile(r'^((\d*)(months|weeks))$')

def walkGirderTree(ancestorFolderId, parentType='folder', parentFolderName=None):
    offset = 0

    while True:
        folders = g.get('folder', parameters={
            'limit': 50,
            'offset': offset,
            'parentType': parentType,
            'parentId': ancestorFolderId
        })
        thisFolder = g.getFolder(ancestorFolderId)
        name = thisFolder['name']
        print parentFolderName, name

        if 'meta' in thisFolder and parentFolderName is not None:
            meta = thisFolder['meta']
            if parentFolderName == 'scan_data':
                newMeta = metadata[name]
                updatedMeta = {
                    'dob': newMeta['DOB'],
                    'folder_type': 'subject',
                    'sex': newMeta['sex'],
                    'subject_id': newMeta['subject']
                }
                for key in meta:
                    if key not in updatedMeta:
                        updatedMeta[key] = None
            else:
                subjectMatches = subject_regex.search(parentFolderName)
                ageMatches = subject_scan_age_regex.search(name)
                if subjectMatches and ageMatches:
                    newMeta = metadata[parentFolderName]
                    scanMeta = [scan for scan in newMeta['scans'] if scan[0] == name][0]
                    updatedMeta = {
                        'dob': newMeta['DOB'],
                        'sex': newMeta['sex'],
                        'subject_id': parentFolderName,
                        'scan_age': scanMeta[0],
                        'scan_date': scanMeta[1],
                        'scan_weight_kg': scanMeta[2],
                        'folder_type': 'scan'
                    }
                    for key in meta:
                        if key not in updatedMeta:
                            updatedMeta[key] = None
                else:
                    # need to remove any meta here
                    updatedMeta = {key: None for key in meta}

            g.addMetadataToFolder(thisFolder['_id'], updatedMeta)
        else:
            # can't do anything without a parentFolderName
            pass

        # recurse on children folders
        for folder in folders:
            walkGirderTree(folder['_id'], 'folder', name)

        # items in current folder
        # shoudn't be more than 50
        items = g.get('item', parameters={
            'folderId': thisFolder['_id']
        })
        for item in items:
            print parentFolderName, name, item['name']
            # remove metadata from items
            updatedItemMeta = {key: None for key in item['meta']}
            if len(updatedItemMeta) > 0:
                g.addMetadataToItem(item['_id'], updatedItemMeta)

        offset += len(folders)
        if len(folders) < 50:
            break



walkGirderTree(parent_id, 'folder')
