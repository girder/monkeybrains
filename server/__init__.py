#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
#  Copyright 2015 Kitware Inc.
#
#  Licensed under the Apache License, Version 2.0 ( the "License" );
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
###############################################################################
import bson
from girder import constants
from girder.api import access
from girder.api.rest import Resource, loadmodel
from girder.api.rest import RestException
from girder.api.describe import Description
from girder.constants import AccessType
from girder.utility.model_importer import ModelImporter

INFOPAGE_FIELD = 'infoPage'


class InfoPage(Resource):

    def _setResourceInfoPage(self, model, resource, params):
        """
        Handle setting infoPage for any resource that supports them.
        :param model: the type of resource (e.g., user or collection)
        :param resource: the resource document.
        :param params: the query parameters.  'infoPage' is required and used.
        :return resource: the updated resource document.
        """
        self.requireParams(('infoPage', ), params)
        infoPage = params['infoPage']
        resource[INFOPAGE_FIELD] = infoPage
        self.model(model).save(resource, validate=False)
        return self._filter(model, resource)

    @access.public
    @loadmodel(model='collection', level=AccessType.READ)
    def getCollectionInfoPage(self, collection, params):
        return self.model('collection').filter(collection,
                                               self.getCurrentUser())
    getCollectionInfoPage.description = (
        Description('Get infoPage for the collection.')
        .param('id', 'The collection ID', paramType='path')
        .errorResponse('ID was invalid.')
        .errorResponse('Read permission denied on the collection.', 403))

    @access.public
    @loadmodel(model='collection', level=AccessType.WRITE)
    def setCollectionInfoPage(self, collection, params):
        return self._setResourceInfoPage('collection', collection, params)
    setCollectionInfoPage.description = (
        Description('Set infoPage for the collection.')
        .param('id', 'The collection ID', paramType='path')
        .param('infoPage', 'A string of Markdown to be displayed as infopage.',
               required=True)
        .errorResponse('ID was invalid.')
        .errorResponse('Write permission denied on the collection.', 403))


class DatasetEvents(Resource):
    @access.public
    @loadmodel(model='collection', level=AccessType.READ)
    def getDatasetEvents(self, collection, params):
        """
        Get the individual events in a dataset, which are defined as folders
        having metadata keys (scan_date, subject_id, scan_weight_kg, DOB) and
        that live under the passed in collection.
        Handle setting infoPage for any resource that supports them.
        :param collection: parent collection of sought events.
        :return resource: the loaded resource document.
        """
        model = self.model('folder')
        # return these metadata keys
        metadata_keys = ['scan_date', 'subject_id', 'DOB', 'scan_weight_kg']
        key_d = {'meta.'+key: 1 for key in metadata_keys}
        # look at folders in this collection with the scan_date metadata key
        condition_d = {'baseParentId': {'$oid': collection['_id']},
                       'meta.scan_date': {'$exists': True}}
        initial = {}
        reduce = "function (curr, result) {}"
        finalize = "function (curr, result) {}"
        try:
            key = bson.json_util.loads(bson.json_util.dumps(key_d))
            condition = bson.json_util.loads(bson.json_util.dumps(condition_d))
        except ValueError:
            raise RestException('The query parameter must be a JSON object.')
        document = \
            model.collection.group(key, condition, initial, reduce, finalize)
        return document
    getDatasetEvents.description = (
        Description('Get datasetEvents for the collection.')
        .param('id', 'The collection ID', paramType='path')
        .errorResponse('ID was invalid.')
        .errorResponse('Read permission denied on the collection.', 403))


def load(info):
    infoPage = InfoPage()
    info['apiRoot'].collection.route('GET', (':id', 'infoPage'),
                                     infoPage.getCollectionInfoPage)
    info['apiRoot'].collection.route('PUT', (':id', 'infoPage'),
                                     infoPage.setCollectionInfoPage)
    datasetEvents = DatasetEvents()
    info['apiRoot'].collection.route('GET', (':id', 'datasetEvents'),
                                     datasetEvents.getDatasetEvents)

    ModelImporter.model('collection').exposeFields(
        level=constants.AccessType.READ, fields='infoPage')
