import CollectionView from '@girder/core/views/body/CollectionView';
import { wrap } from '@girder/core/utilities/PluginUtils';

import InfoPageWidget from './views/InfoPageWidget';

wrap(CollectionView, 'render', function (render) {
    render.call(this);

    if (this.model.get('monkeybrains')) {
        this.infoPageWidget = new InfoPageWidget({
            model: this.model,
            access: this.access,
            parentView: this,
            el: this.$('.g-collection-infopage')
        });
        this.infoPageWidget.$el
            .insertAfter(this.$('.g-collection-header'));
    }

    return this;
});
