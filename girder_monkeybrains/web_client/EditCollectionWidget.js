import EditCollectionWidget from '@girder/core/views/widgets/EditCollectionWidget';
import { wrap } from '@girder/core/utilities/PluginUtils';

import EditCollectionInfopageTemplate from './templates/editCollectionInfopage.pug';

wrap(EditCollectionWidget, 'render', function (render) {
    render.call(this);

    if (this.model && this.model.get('monkeybrains')) {
        this.$('.g-validation-failed-message')
            .before(EditCollectionInfopageTemplate());

        const infoPage = this.model.get('monkeybrainsInfoPage');
        if (infoPage && infoPage !== '') {
            this.$('#g-collection-infopage-edit').val(infoPage);
        }
    }

    return this;
});

wrap(EditCollectionWidget, '_saveCollection', function (_saveCollection, fields) {
    fields.monkeybrainsInfoPage = this.$('#g-collection-infopage-edit').val();
    return _saveCollection.call(this, fields);
});
