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

from girder.api import access
from girder.api.rest import Resource, loadmodel
from girder.api.describe import Description
from girder.constants import AccessType


INFOPAGE_FIELD = 'infoPage'


class InfoPage(Resource):

    def _filter(self, model, resource):
        """
        Filter a resource to include only the ordinary data and the infoPage
        field.
        :param model: the type of resource (e.g., user or collection)
        :param resource: the resource document.
        :return: filtered field of the resource with the infoPage data, if any.
        """
        filtered = self.model(model).filter(resource, self.getCurrentUser())
        filtered[INFOPAGE_FIELD] = resource.get(INFOPAGE_FIELD, {})
        return filtered

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
        return self._filter('collection', collection)
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


def load(info):
    infoPage = InfoPage()
    info['apiRoot'].collection.route('GET', (':id', 'infoPage'),
                                     infoPage.getCollectionInfoPage)
    info['apiRoot'].collection.route('PUT', (':id', 'infoPage'),
                                     infoPage.setCollectionInfoPage)
