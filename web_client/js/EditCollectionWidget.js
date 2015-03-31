girder.wrap(girder.views.EditCollectionWidget, 'render', function (render) {
    var view, monkeybrains, infoPage;
    view = this;
    render.call(view);
    if (view.model) {
        monkeybrains = view.model.get('monkeybrains');
        if (monkeybrains) {
            $('.g-validation-failed-message').before(girder.templates.monkeybrains_editCollectionInfopage());
            infoPage = view.model.get('monkeybrainsInfoPage');
            if (infoPage && infoPage !== '') {
                view.$('#g-collection-infopage-edit').val(infoPage);
            }
        }
    }

    return view;
});

girder.wrap(girder.views.EditCollectionWidget, 'updateCollection', function (updateCollection, fields) {
    var view, infoPage;
    view = this;
    infoPage = view.$('#g-collection-infopage-edit').val();
    fields.monkeybrainsInfoPage = infoPage;
    updateCollection.call(view, fields);
    return view;
});
