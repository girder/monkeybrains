#!/usr/bin/env python

# this parent id is for maryae private file run
import girder_client
parent_id = '5c904bf98d777f072bbeac81'
port = 443
scheme = 'https'
host = 'data.kitware.com'


# TODO change dryrun to True
# run it first with dryun False to see that it looks good
gc = girder_client.GirderClient(host=host, port=port, scheme=scheme)
#,dryrun=True)
gc.authenticate(interactive=True)
gc.upload('/Animal/primate/CoeMonkeyAtlasDev/DATA_RELEASE/DATA/*', parent_id, reuse_existing=True)