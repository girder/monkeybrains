girder.views.monkeybrains_EditCollectionWidget = girder.View.extend({});

girder.wrap(girder.views.EditCollectionWidget, 'render', function (render) {
    var view = this;
    render.call(this);
    if (view.model) {
        var monkeybrains = this.model.get('monkeybrains');
        if (monkeybrains) {
            $('.g-validation-failed-message').before(girder.templates.monkeybrains_editCollectionInfopage());
            var infoPage = this.model.get('monkeybrainsInfoPage');
            if (infoPage && infoPage !== '') {
                view.$('#g-collection-infopage-edit').val(infoPage);
            }
        }
    }

    return this;
});

girder.wrap(girder.views.EditCollectionWidget, 'updateCollection', function (updateCollection, fields) {
    var view = this;
    var infoPage = view.$('#g-collection-infopage-edit').val();
    fields.monkeybrainsInfoPage = infoPage;
    updateCollection.call(this, fields);
    return this;
});
